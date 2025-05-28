import { type EntropyHash, type ServiceGas, type ServiceId, type TimeSlot, tryAsServiceGas } from "@typeberry/block";
import type { WorkPackageHash, WorkReport } from "@typeberry/block/work-report";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Encoder, codec } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";

import { KeccakHasher } from "@typeberry/hash/keccak";
import { PartialStateDb } from "@typeberry/jam-host-calls/externalities/partial-state-db";
import type { PendingTransfer } from "@typeberry/jam-host-calls/externalities/pending-transfer";
import type { StateUpdate } from "@typeberry/jam-host-calls/externalities/state-update";
import { Logger } from "@typeberry/logger";
import { type U32, tryAsU32, u32AsLeBytes } from "@typeberry/numbers";
import { tryAsGas } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status";
import { AutoAccumulate, PrivilegedServices, type Service, type State, tryAsPerCore } from "@typeberry/state";
import { InMemoryTrie } from "@typeberry/trie";
import { getKeccakTrieHasher } from "@typeberry/trie/hasher";
import { Result } from "@typeberry/utils";
import { AccumulateQueue, type QueueItem, pruneQueue } from "./accumulate-queue";
import { getWorkPackageHashes, uniquePreserveOrder } from "./accumulate-utils";
import {
  AccountsInfoExternalities,
  AccountsLookupExternalities,
  AccountsReadExternalities,
  AccountsWriteExternalities,
  AccumulateFetchExternalities,
} from "./externalities";
import { Operand } from "./operand";
import { PvmExecutor } from "./pvm-executor";

export type AccumulateRoot = OpaqueHash;

export type AccumulateInput = {
  slot: TimeSlot;
  reports: WorkReport[];
};

export type AccumulateState = {
  timeslot: TimeSlot;
  entropy: EntropyHash;
  readyQueue: QueueItem[][];
  accumulated: WorkPackageHash[][];
  privileges: PrivilegedServices;
  services: Map<ServiceId, Service>;
  designatedValidatorData?: State["designatedValidatorData"];
  authQueues?: State["authQueues"];
};

type InvocationResult = {
  stateUpdate: StateUpdate | null;
  consumedGas: ServiceGas;
};

type ParallelAccumulationResult = {
  gasCosts: [ServiceId, ServiceGas][];
  yieldedRoots: [ServiceId, OpaqueHash][];
  pendingTransfers: [ServiceId, PendingTransfer[]][];
};

type SequentialAccumulationResult = ParallelAccumulationResult & {
  accumulatedReports: U32;
};

enum PvmInvocationError {
  NoService = 0,
  NoPreimage = 1,
}

/** `G_A`: The gas allocated to invoke a work-report’s Accumulation logic. */
const GAS_TO_INVOKE_WORK_REPORT = 10_000_000n;

/** `G_T`: The total gas allocated across all Accumulation. */
const ACCUMULATE_TOTAL_GAS = 3_500_000_000n;

const logger = Logger.new(__filename, "accumulate");

export class Accumulate {
  constructor(
    public readonly state: AccumulateState,
    public readonly chainSpec: ChainSpec,
  ) {}

  findReportCutoffIndex(gasLimit: ServiceGas, reports: WorkReport[]) {
    const reportsLength = reports.length;
    let currentGas = 0n;

    for (let i = 0; i < reportsLength; i++) {
      const report = reports[i];
      const resultsGas = report.results.map((result) => result.gas).reduce((a, b) => a + b, 0n);

      if (currentGas + resultsGas > gasLimit) {
        return i;
      }

      currentGas += resultsGas;
    }

    return reportsLength;
  }

  async pvmAccumulateInvocation(
    slot: TimeSlot,
    serviceId: ServiceId,
    operands: Operand[],
    gas: ServiceGas,
  ): Promise<Result<InvocationResult, PvmInvocationError>> {
    const service = this.state.services.get(serviceId);
    if (service === undefined) {
      logger.log(`Service with id ${serviceId} not found.`);
      return Result.error(PvmInvocationError.NoService);
    }

    const codeHash = service.data.info.codeHash;
    const code = service.data.preimages.get(codeHash.asOpaque());

    if (code === undefined) {
      logger.log(`Code with hash ${codeHash} not found for service ${serviceId}.`);
      return Result.error(PvmInvocationError.NoPreimage);
    }

    const partialState = new PartialStateDb({ services: this.state.services, timeslot: slot }, serviceId);

    const externalities = {
      partialState,
      fetchExternalities: new AccumulateFetchExternalities(this.state.entropy, operands, this.chainSpec),
      accountsInfo: new AccountsInfoExternalities(this.state.services),
      accountsRead: new AccountsReadExternalities(),
      accountsWrite: new AccountsWriteExternalities(),
      accountsLookup: new AccountsLookupExternalities(),
    };

    const executor = new PvmExecutor(code.blob, externalities, this.chainSpec);
    const slotEncoded = u32AsLeBytes(slot);
    const serviceIdEncoded = u32AsLeBytes(serviceId);
    const operandsEncoded = Encoder.encodeObject(codec.sequenceVarLen(Operand.Codec), operands, this.chainSpec);
    const args = BytesBlob.blobFromParts([slotEncoded, serviceIdEncoded, operandsEncoded.raw]);

    const result = await executor.run(args, tryAsGas(gas));
    const [newState, checkpoint] = partialState.getStateUpdates();

    if (result.hasStatus()) {
      const status = result.statusOrMemorySlice;
      if (status === Status.OOG || status === Status.PANIC) {
        return Result.ok({ stateUpdate: checkpoint, consumedGas: tryAsServiceGas(result.consumedGas) });
      }
    }

    if (result.hasMemorySlice() && result.statusOrMemorySlice.length === HASH_SIZE) {
      const memorySlice = Bytes.fromBlob(result.statusOrMemorySlice, HASH_SIZE);
      newState.yieldedRoot = memorySlice.asOpaque();
    }

    return Result.ok({ stateUpdate: newState, consumedGas: tryAsServiceGas(result.consumedGas) });
  }

  private getOperandsAndGasCost(serviceId: ServiceId, reports: WorkReport[]) {
    let gasCost =
      this.state.privileges.autoAccumulateServices.find((x) => x.service === serviceId)?.gasLimit ??
      tryAsServiceGas(0n);

    const operands: Operand[] = [];

    for (const report of reports) {
      for (const result of report.results) {
        if (result.serviceId === serviceId) {
          gasCost = tryAsServiceGas(gasCost + result.gas);

          operands.push(
            Operand.new({
              gas: result.gas, // g
              payloadHash: result.payloadHash, // y
              result: result.result, // d
              authorizationOutput: report.authorizationOutput, // o
              exportsRoot: report.workPackageSpec.exportsRoot, // e
              hash: report.workPackageSpec.hash, // h
              authorizerHash: report.authorizerHash, // a
            }),
          );
        }
      }
    }

    return { operands, gasCost };
  }

  async accumulateSingleService(serviceId: ServiceId, reports: WorkReport[], slot: TimeSlot) {
    const { operands, gasCost } = this.getOperandsAndGasCost(serviceId, reports);

    const result = await this.pvmAccumulateInvocation(slot, serviceId, operands, gasCost);

    if (result.isError) {
      return { stateUpdate: null, consumedGas: 0n };
    }

    return result.ok;
  }

  async accumulateSequentially(
    gasLimit: ServiceGas,
    reports: WorkReport[],
    slot: TimeSlot,
  ): Promise<SequentialAccumulationResult> {
    const i = this.findReportCutoffIndex(gasLimit, reports);

    if (i === 0) {
      return {
        accumulatedReports: tryAsU32(0),
        gasCosts: [],
        yieldedRoots: [],
        pendingTransfers: [],
      };
    }

    const reportsToAccumulateInParallel = reports.slice(0, i);
    const reportsToAccumulateSequentially = reports.slice(i);

    const parallelAccumulationResult = await this.accumulateInParallel(reportsToAccumulateInParallel, slot);
    const consumedGas = parallelAccumulationResult.gasCosts.reduce((acc, [_, gas]) => acc + gas, 0n);
    const sequentialAccumulationResult = await this.accumulateSequentially(
      tryAsServiceGas(gasLimit - consumedGas),
      reportsToAccumulateSequentially,
      slot,
    );

    return {
      accumulatedReports: tryAsU32(i + sequentialAccumulationResult.accumulatedReports),
      gasCosts: parallelAccumulationResult.gasCosts.concat(sequentialAccumulationResult.gasCosts),
      yieldedRoots: parallelAccumulationResult.yieldedRoots.concat(sequentialAccumulationResult.yieldedRoots),
      pendingTransfers: parallelAccumulationResult.pendingTransfers.concat(
        sequentialAccumulationResult.pendingTransfers,
      ),
    };
  }

  async accumulateInParallel(reports: WorkReport[], slot: TimeSlot): Promise<ParallelAccumulationResult> {
    const autoAccumulateServiceIds = this.state.privileges.autoAccumulateServices.map(({ service }) => service);
    const allServiceIds = reports
      .flatMap((report) => report.results.map((result) => result.serviceId))
      .concat(Array.from(autoAccumulateServiceIds));
    const serviceIds = uniquePreserveOrder(autoAccumulateServiceIds.concat(allServiceIds));

    const gasCosts: [ServiceId, ServiceGas][] = [];
    const yieldedRoots: [ServiceId, OpaqueHash][] = [];
    const pendingTransfers: [ServiceId, PendingTransfer[]][] = [];

    for (const serviceId of serviceIds) {
      const { consumedGas, stateUpdate } = await this.accumulateSingleService(serviceId, reports, slot);

      if (stateUpdate === null) {
        continue;
      }

      gasCosts.push([serviceId, tryAsServiceGas(consumedGas)]);

      if (stateUpdate.yieldedRoot !== null) {
        yieldedRoots.push([serviceId, stateUpdate.yieldedRoot]);
      }

      pendingTransfers.push([serviceId, stateUpdate.transfers]);

      this.updateServicesInState(stateUpdate, serviceId, slot);
    }

    return {
      pendingTransfers,
      yieldedRoots,
      gasCosts,
    };
  }

  private updateServicesInState(stateUpdate: StateUpdate, serviceId: ServiceId, slot: TimeSlot): void {
    const { authManager, manager, validatorsManager } = this.state.privileges;

    if (serviceId === manager && stateUpdate.priviledgedServices !== null) {
      const priviledgedServices = stateUpdate.priviledgedServices;

      this.state.privileges = PrivilegedServices.create({
        manager: priviledgedServices.manager,
        authManager: priviledgedServices.authorizer,
        validatorsManager: priviledgedServices.validators,
        autoAccumulateServices: priviledgedServices.autoAccumulate.map(([service, gasLimit]) =>
          AutoAccumulate.create({ gasLimit, service }),
        ),
      });
    }

    if (serviceId === authManager && stateUpdate.authorizationQueues !== null) {
      if (this.state.authQueues === undefined) {
        const queue = new Array(this.chainSpec.coresCount);
        queue.fill([]);
        this.state.authQueues = tryAsPerCore(queue, this.chainSpec);
      }

      for (const [coreIndex, authQueue] of stateUpdate.authorizationQueues) {
        this.state.authQueues[coreIndex].push(...authQueue.map((hash) => hash.asOpaque()));
      }
    }

    if (serviceId === validatorsManager && stateUpdate.validatorsData !== null) {
      this.state.designatedValidatorData = stateUpdate.validatorsData;
    }

    if (stateUpdate.updatedServiceInfo !== null) {
      const currentService = this.state.services.get(serviceId);
      if (currentService !== undefined) {
        currentService.data.info = stateUpdate.updatedServiceInfo;
      }
    }

    if (stateUpdate.newServices !== null) {
      for (const service of stateUpdate.newServices) {
        const serviceId = service.id;
        this.state.services.set(serviceId, service);
      }
    }

    if (stateUpdate.ejectedServices !== null) {
      for (const serviceId of stateUpdate.ejectedServices) {
        this.state.services.delete(serviceId);
      }
    }

    for (const { item, serviceId } of stateUpdate.providedPreimages) {
      const { blob, hash } = item;
      const slots = this.state.services
        .get(serviceId)
        ?.data.lookupHistory.get(hash)
        ?.find(({ length }) => length === blob.length)?.slots;

      if (slots !== undefined && slots.length === 0) {
        slots.push(slot);
        this.state.services.get(serviceId)?.data.preimages.set(hash, item);
      }
    }
  }

  private updateState(accumulated: WorkReport[], toAccumulateLater: QueueItem[], slot: TimeSlot) {
    const epochLength = this.chainSpec.epochLength;

    for (let i = 0; i < epochLength - 1; i++) {
      this.state.accumulated[i] = this.state.accumulated[i + 1];
    }

    this.state.accumulated[epochLength - 1] = getWorkPackageHashes(accumulated);

    const phaseIndex = slot % epochLength;

    this.state.readyQueue[phaseIndex] = pruneQueue(
      toAccumulateLater,
      this.state.accumulated[this.chainSpec.epochLength - 1],
    );

    for (let i = 1; i < epochLength; i++) {
      if (i < slot - this.state.timeslot) {
        this.state.readyQueue[(phaseIndex + epochLength - i) % epochLength] = [];
      } else {
        const queueIndex = (phaseIndex + epochLength - i) % epochLength;
        this.state.readyQueue[queueIndex] = pruneQueue(
          this.state.readyQueue[queueIndex],
          this.state.accumulated[epochLength - 1],
        );
      }
    }

    this.state.timeslot = slot;
  }

  private getGasLimit() {
    const calculatedGasLimit =
      GAS_TO_INVOKE_WORK_REPORT * BigInt(this.chainSpec.coresCount) +
      this.state.privileges.autoAccumulateServices.reduce((acc, { gasLimit }) => acc + gasLimit, 0n);
    const gasLimit = tryAsServiceGas(
      ACCUMULATE_TOTAL_GAS > calculatedGasLimit ? ACCUMULATE_TOTAL_GAS : calculatedGasLimit,
    );

    return tryAsServiceGas(gasLimit);
  }

  async transition({ reports, slot }: AccumulateInput): Promise<Result<AccumulateRoot, never>> {
    const accumulateQueue = new AccumulateQueue(this.state, this.chainSpec);
    const toAccumulateImmediately = accumulateQueue.getWorkReportsToAccumulateImmediately(reports);
    const toAccumulateLater = accumulateQueue.getWorkReportsToAccumulateLater(reports);
    const queueFromState = accumulateQueue.getQueueFromState(slot);

    const toEnqueue = pruneQueue(
      queueFromState.concat(toAccumulateLater),
      getWorkPackageHashes(toAccumulateImmediately),
    );
    const queue = accumulateQueue.enqueueReports(toEnqueue);
    const accumulatableReports = toAccumulateImmediately.concat(queue);

    const gasLimit = this.getGasLimit();

    const { accumulatedReports, yieldedRoots } = await this.accumulateSequentially(
      gasLimit,
      accumulatableReports,
      slot,
    );
    const accumulated = accumulatableReports.slice(0, accumulatedReports);

    this.updateState(accumulated, toAccumulateLater, slot);

    const rootHash = await getRootHash(yieldedRoots);
    return Result.ok(rootHash);
  }
}

async function getRootHash(yieldedRoots: [ServiceId, OpaqueHash][]): Promise<AccumulateRoot> {
  const keccakHasher = await KeccakHasher.create();
  const trieHasher = getKeccakTrieHasher(keccakHasher);
  const trie = InMemoryTrie.empty(trieHasher);
  const yieldedRootsSortedByServiceId = yieldedRoots.sort((a, b) => a[0] - b[0]);

  for (const [serviceId, hash] of yieldedRootsSortedByServiceId) {
    const keyVal = BytesBlob.blobFromParts([u32AsLeBytes(serviceId), hash.raw]);
    trie.set(Bytes.fromBlob(keyVal.raw, 36).asOpaque(), keyVal);
  }

  return trie.getRootHash().asOpaque();
}
