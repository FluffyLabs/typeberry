/**
 * Worker thread entry point for PVM accumulation.
 *
 * Runs accumulateSingleService + pvmAccumulateInvocation in an isolated
 * V8 context for better JIT optimization of the PVM interpreter.
 */
import { type MessagePort, workerData } from "node:worker_threads";
import type { EntropyHash, TimeSlot } from "@typeberry/block";
import { type ServiceGas, type ServiceId, tryAsServiceGas } from "@typeberry/block";
import { W_C } from "@typeberry/block/gp-constants.js";
import { Bytes } from "@typeberry/bytes";
import { codec, Encoder } from "@typeberry/codec";
import type { ChainSpec, PvmBackend } from "@typeberry/config";
import { PvmExecutor, ReturnStatus } from "@typeberry/executor";
import { Blake2b, HASH_SIZE } from "@typeberry/hash";
import type { PendingTransfer } from "@typeberry/jam-host-calls";
import {
  type AccumulationStateUpdate,
  PartiallyUpdatedState,
} from "@typeberry/jam-host-calls/externalities/state-update.js";
import { sumU64, tryAsU32 } from "@typeberry/numbers";
import { type Service, ServiceAccountInfo } from "@typeberry/state";
import { Result } from "@typeberry/utils";
import { AccumulateExternalities } from "../../externalities/accumulate-externalities.js";
import { AccumulateFetchExternalities } from "../../externalities/accumulate-fetch-externalities.js";
import { generateNextServiceId } from "../accumulate-utils.js";
import type { Operand } from "../operand.js";
import { type AccumulateRequest, type AccumulateResponse, type GetServiceResponse, MessageType } from "./protocol.js";
import {
  deserializeAccumulationStateUpdate,
  deserializeOperand,
  deserializePendingTransfer,
  deserializePrivilegedServices,
  deserializeService,
  serializeAccumulationStateUpdate,
} from "./serialization.js";

const ARGS_CODEC = codec.object({
  slot: codec.varU32.asOpaque<TimeSlot>(),
  serviceId: codec.varU32.asOpaque<ServiceId>(),
  argsLength: codec.varU32,
});

// ── Worker state ─────────────────────────────────────────────────────────────

const { dataPort } = workerData as { dataPort: MessagePort };

/** Blake2b hasher — created once per worker lifetime. */
let blake2bInstance: Blake2b | null = null;

async function getBlake2b(): Promise<Blake2b> {
  if (blake2bInstance === null) {
    blake2bInstance = await Blake2b.createHasher();
  }
  return blake2bInstance;
}

/** Cache of services fetched from main thread (per-request). */
const serviceCache = new Map<ServiceId, Service | null>();

/** Pending getService requests waiting for main thread response. */
let pendingGetService: ((service: Service | null) => void) | null = null;

// ── Async getService via MessagePort ─────────────────────────────────────────

function getServiceAsync(serviceId: ServiceId): Promise<Service | null> {
  const cached = serviceCache.get(serviceId);
  if (cached !== undefined) {
    return Promise.resolve(cached);
  }

  return new Promise((resolve) => {
    pendingGetService = (service) => {
      serviceCache.set(serviceId, service);
      resolve(service);
    };
    dataPort.postMessage({ type: MessageType.GetServiceRequest, serviceId });
  });
}

/** Handle incoming GetServiceResponse from main thread. */
function handleGetServiceResponse(msg: GetServiceResponse) {
  const service = msg.service !== null ? deserializeService(msg.service) : null;
  if (pendingGetService !== null) {
    const resolve = pendingGetService;
    pendingGetService = null;
    resolve(service);
  }
}

// ── Accumulation logic (mirrors accumulate.ts) ───────────────────────────────

async function runAccumulation(request: AccumulateRequest): Promise<AccumulateResponse> {
  const blake2b = await getBlake2b();

  const transfers = request.transfers.map(deserializePendingTransfer);
  const operands = request.operands.map(deserializeOperand);
  const entropy = Bytes.fromBlob(request.entropy, HASH_SIZE).asOpaque<EntropyHash>();
  const inputStateUpdate = deserializeAccumulationStateUpdate(request.inputStateUpdate);
  const privilegedServices = deserializePrivilegedServices(request.privilegedServices);
  const { serviceId, gasCost, slot, chainSpec, pvmBackend } = request;

  serviceCache.clear();

  // State proxy — getService is sync (returns null, overlay handles it),
  // getServiceAsync fetches from main thread.
  const state = {
    getService: (_id: ServiceId) => null as Service | null,
    getServiceAsync,
    privilegedServices,
  };

  const updatedState = new PartiallyUpdatedState(state, inputStateUpdate);

  // Update balance from incoming transfers
  const serviceInfo = await updatedState.getServiceInfoAsync(serviceId);
  if (serviceInfo !== null) {
    const newBalance = sumU64(serviceInfo.balance, ...transfers.map((item) => item.amount));

    if (newBalance.overflow) {
      return {
        type: MessageType.AccumulateResponse,
        consumedGas: tryAsServiceGas(0n),
        stateUpdate: null,
      };
    }

    const newInfo = ServiceAccountInfo.create({ ...serviceInfo, balance: newBalance.value });
    updatedState.updateServiceInfo(serviceId, newInfo);
  }

  const result = await pvmAccumulateInvocation(
    blake2b,
    chainSpec,
    pvmBackend,
    slot,
    serviceId,
    transfers,
    operands,
    gasCost,
    entropy,
    updatedState,
  );

  if (result.isError) {
    return {
      type: MessageType.AccumulateResponse,
      consumedGas: tryAsServiceGas(0n),
      stateUpdate: serializeAccumulationStateUpdate(updatedState.stateUpdate),
    };
  }

  return {
    type: MessageType.AccumulateResponse,
    consumedGas: result.ok.consumedGas,
    stateUpdate: serializeAccumulationStateUpdate(result.ok.stateUpdate),
  };
}

enum PvmInvocationError {
  NoService = 0,
  NoPreimage = 1,
  PreimageTooLong = 2,
}

async function pvmAccumulateInvocation(
  blake2b: Blake2b,
  chainSpec: ChainSpec,
  pvmBackend: PvmBackend,
  slot: TimeSlot,
  serviceId: ServiceId,
  transfers: PendingTransfer[],
  operands: Operand[],
  gas: ServiceGas,
  entropy: EntropyHash,
  updatedState: PartiallyUpdatedState,
): Promise<Result<{ stateUpdate: AccumulationStateUpdate; consumedGas: ServiceGas }, PvmInvocationError>> {
  const serviceInfo = await updatedState.getServiceInfoAsync(serviceId);
  if (serviceInfo === null) {
    return Result.error(PvmInvocationError.NoService, () => `Accumulate: service ${serviceId} not found`);
  }

  const codeHash = serviceInfo.codeHash;
  const code = await updatedState.getPreimageAsync(serviceId, codeHash.asOpaque());
  if (code === null) {
    return Result.error(PvmInvocationError.NoPreimage, () => `Accumulate: code not found for service ${serviceId}`);
  }

  if (code.length > W_C) {
    return Result.error(PvmInvocationError.PreimageTooLong, () => `Accumulate: code too long for service ${serviceId}`);
  }

  const nextServiceId = generateNextServiceId({ serviceId, entropy, timeslot: slot }, chainSpec, blake2b);
  const partialState = new AccumulateExternalities(chainSpec, blake2b, updatedState, serviceId, nextServiceId, slot);
  const fetchExternalities = new AccumulateFetchExternalities(entropy, transfers, operands, chainSpec);

  const externalities = {
    partialState,
    serviceExternalities: partialState,
    fetchExternalities,
  };

  const executor = await PvmExecutor.createAccumulateExecutor(serviceId, code, externalities, chainSpec, pvmBackend);

  const invocationArgs = Encoder.encodeObject(ARGS_CODEC, {
    slot,
    serviceId,
    argsLength: tryAsU32(transfers.length + operands.length),
  });
  const result = await executor.run(invocationArgs, gas);
  const [newState, checkpoint] = partialState.getStateUpdates();

  if (result.status !== ReturnStatus.OK) {
    return Result.ok({ stateUpdate: checkpoint, consumedGas: tryAsServiceGas(result.consumedGas) });
  }

  if (result.memorySlice.length === HASH_SIZE) {
    const memorySlice = Bytes.fromBlob(result.memorySlice, HASH_SIZE);
    newState.yieldedRoot = memorySlice.asOpaque();
  }

  return Result.ok({ stateUpdate: newState, consumedGas: tryAsServiceGas(result.consumedGas) });
}

// ── Message handler ──────────────────────────────────────────────────────────

dataPort.on("message", (msg: AccumulateRequest | GetServiceResponse) => {
  if ((msg as GetServiceResponse).type === MessageType.GetServiceResponse) {
    handleGetServiceResponse(msg as GetServiceResponse);
    return;
  }

  if ((msg as AccumulateRequest).type !== MessageType.AccumulateRequest) {
    return;
  }

  runAccumulation(msg as AccumulateRequest)
    .then((response) => {
      dataPort.postMessage(response);
    })
    .catch((err) => {
      const error = err instanceof Error ? err.message : String(err);
      dataPort.postMessage({
        type: MessageType.AccumulateResponse,
        consumedGas: tryAsServiceGas(0n),
        stateUpdate: null,
        error,
      } satisfies AccumulateResponse);
    });
});
