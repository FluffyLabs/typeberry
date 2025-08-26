import {
  type EntropyHash,
  type ServiceGas,
  type ServiceId,
  type TimeSlot,
  tryAsPerEpochBlock,
  tryAsServiceGas,
} from "@typeberry/block";
import type { WorkReport } from "@typeberry/block/work-report.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Encoder, codec } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";

import { HashSet } from "@typeberry/collections";
import { KeccakHasher } from "@typeberry/hash/keccak.js";
import { AccumulateExternalities } from "@typeberry/jam-host-calls/externalities/accumulate-externalities.js";
import type { PendingTransfer } from "@typeberry/jam-host-calls/externalities/pending-transfer.js";
import {
  AccumulationStateUpdate,
  PartiallyUpdatedState,
  type ServiceStateUpdate,
} from "@typeberry/jam-host-calls/externalities/state-update.js";
import { Logger } from "@typeberry/logger";
import { type U32, tryAsU32, u32AsLeBytes } from "@typeberry/numbers";
import { tryAsGas } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status.js";
import { ServiceAccountInfo, type ServicesUpdate, type State, hashComparator, tryAsPerCore } from "@typeberry/state";
import { binaryMerkleization } from "@typeberry/state-merkleization";
import type { NotYetAccumulatedReport } from "@typeberry/state/not-yet-accumulated.js";
import { getKeccakTrieHasher } from "@typeberry/trie/hasher.js";
import { Compatibility, GpVersion, Result, assertEmpty } from "@typeberry/utils";
import { FetchExternalities } from "../externalities/index.js";
import type { CountAndGasUsed } from "../statistics.js";
import { AccumulateData } from "./accumulate-data.js";
import { AccumulateQueue, pruneQueue } from "./accumulate-queue.js";
import { generateNextServiceId, getWorkPackageHashes } from "./accumulate-utils.js";
import { Operand, Operand_0_6_4 } from "./operand.js";
import { PvmExecutor } from "./pvm-executor.js";

export type AccumulateRoot = OpaqueHash;

export type AccumulateInput = {
  /** time slot from header */
  slot: TimeSlot;
  /** List of newly available work-reports */
  reports: WorkReport[];
  /** eta0' (after Safrole STF) - it is not eta0 from state! */
  entropy: EntropyHash;
};

export type AccumulateState = Pick<
  State,
  | "designatedValidatorData"
  | "timeslot"
  | "authQueues"
  | "getService"
  | "recentlyAccumulated"
  | "accumulationQueue"
  | "privilegedServices"
>;

/** Aggregated update of the accumulation state transition. */
export type AccumulateStateUpdate = Pick<
  State,
  /* TODO [ToDr] seems that we are doing the same stuff as safrole? */
  "timeslot"
> &
  Partial<Pick<State, "recentlyAccumulated" | "accumulationQueue">> &
  ServiceStateUpdate;

export type AccumulateResult = {
  root: AccumulateRoot;
  stateUpdate: AccumulateStateUpdate;
  accumulationStatistics: Map<ServiceId, CountAndGasUsed>;
  pendingTransfers: PendingTransfer[];
};

export const ACCUMULATION_ERROR = "duplicate service created";
export type ACCUMULATION_ERROR = typeof ACCUMULATION_ERROR;

type InvocationResult = {
  stateUpdate: AccumulationStateUpdate | null;
  consumedGas: ServiceGas;
};

type ParallelAccumulationResult = {
  state: AccumulationStateUpdate;
  gasCost: ServiceGas;
};

type SequentialAccumulationResult = ParallelAccumulationResult & {
  accumulatedReports: U32;
};

enum PvmInvocationError {
  NoService = 0,
  NoPreimage = 1,
}

/** `G_A`: The gas allocated to invoke a work-report’s Accumulation logic. */
export const GAS_TO_INVOKE_WORK_REPORT = 10_000_000n;

/** `G_T`: The total gas allocated across all Accumulation. */
export const ACCUMULATE_TOTAL_GAS = 3_500_000_000n;

const logger = Logger.new(import.meta.filename, "accumulate");

const ARGS_CODEC_0_6_4 = codec.object({
  slot: codec.u32.asOpaque<TimeSlot>(),
  serviceId: codec.u32.asOpaque<ServiceId>(),
  operands: codec.sequenceVarLen(Operand_0_6_4.Codec),
});

const ARGS_CODEC_0_6_5 = codec.object({
  slot: codec.u32.asOpaque<TimeSlot>(),
  serviceId: codec.u32.asOpaque<ServiceId>(),
  operands: codec.sequenceVarLen(Operand.Codec),
});

const ARGS_CODEC = codec.object({
  slot: codec.varU32.asOpaque<TimeSlot>(),
  serviceId: codec.varU32.asOpaque<ServiceId>(),
  operands: codec.varU32,
});

export class Accumulate {
  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly state: AccumulateState,
  ) {}

  /**
   * Returns an index that determines how many WorkReports can be processed before exceeding a given gasLimit.
   *
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/170a01170a01?v=0.6.7
   */
  private findReportCutoffIndex(gasLimit: ServiceGas, reports: WorkReport[]) {
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

  /**
   * A method that prepres PVM executor and state to run accumulation
   *
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/2fdb012fdb01?v=0.6.7
   */
  private async pvmAccumulateInvocation(
    slot: TimeSlot,
    serviceId: ServiceId,
    operands: Operand[],
    gas: ServiceGas,
    entropy: EntropyHash,
    inputStateUpdate: AccumulationStateUpdate,
  ): Promise<Result<InvocationResult, PvmInvocationError>> {
    const service = this.state.getService(serviceId);
    if (service === null) {
      logger.log(`Service with id ${serviceId} not found.`);
      return Result.error(PvmInvocationError.NoService);
    }

    const codeHash = service.getInfo().codeHash;
    // TODO [ToDr] Should we check that the preimage is still available?
    const code = service.getPreimage(codeHash.asOpaque());

    if (code === null) {
      logger.log(`Code with hash ${codeHash} not found for service ${serviceId}.`);
      return Result.error(PvmInvocationError.NoPreimage);
    }

    const nextServiceId = generateNextServiceId({ serviceId, entropy, timeslot: slot }, this.chainSpec);
    const partialState = new AccumulateExternalities(
      this.chainSpec,
      new PartiallyUpdatedState(this.state, inputStateUpdate),
      serviceId,
      nextServiceId,
      slot,
    );

    const externalities = {
      partialState,
      serviceExternalities: partialState,
      fetchExternalities: FetchExternalities.createForAccumulate({ entropy, operands }, this.chainSpec),
    };

    const executor = PvmExecutor.createAccumulateExecutor(serviceId, code, externalities, this.chainSpec);

    let args = BytesBlob.empty();
    if (Compatibility.is(GpVersion.V0_6_4)) {
      args = Encoder.encodeObject(ARGS_CODEC_0_6_4, { slot, serviceId, operands }, this.chainSpec);
    } else if (Compatibility.is(GpVersion.V0_6_5)) {
      args = Encoder.encodeObject(ARGS_CODEC_0_6_5, { slot, serviceId, operands }, this.chainSpec);
    } else {
      args = Encoder.encodeObject(ARGS_CODEC, { slot, serviceId, operands: tryAsU32(operands.length) });
    }

    const result = await executor.run(args, tryAsGas(gas));

    const [newState, checkpoint] = partialState.getStateUpdates();

    /**
     * PVM invocation returned and error so we return the checkpoint
     *
     * https://graypaper.fluffylabs.dev/#/7e6ff6a/300002300002?v=0.6.7
     */
    if (result.hasStatus()) {
      const status = result.status;
      if (status === Status.OOG || status === Status.PANIC) {
        return Result.ok({ stateUpdate: checkpoint, consumedGas: tryAsServiceGas(result.consumedGas) });
      }
    }

    /**
     * PVM invocation returned a hash so we override whatever `yield` host call
     * provided.
     *
     * https://graypaper.fluffylabs.dev/#/7e6ff6a/301202301202?v=0.6.7
     */
    if (result.hasMemorySlice() && result.memorySlice.length === HASH_SIZE) {
      const memorySlice = Bytes.fromBlob(result.memorySlice, HASH_SIZE);
      newState.yieldedRoots.set(serviceId, memorySlice.asOpaque());
    }

    /**
     * Everything was okay so we can return a new state
     *
     * https://graypaper.fluffylabs.dev/#/7e6ff6a/302302302302?v=0.6.7
     */
    return Result.ok({ stateUpdate: newState, consumedGas: tryAsServiceGas(result.consumedGas) });
  }

  /**
   * A method that accumulate reports connected with a single service
   *
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/18d70118d701?v=0.6.7
   */
  private async accumulateSingleService(
    serviceId: ServiceId,
    operands: Operand[],
    gasCost: ServiceGas,
    slot: TimeSlot,
    entropy: EntropyHash,
    inputStateUpdate: AccumulationStateUpdate,
  ) {
    logger.trace(`Accumulating service ${serviceId}, items: ${operands.length} at slot: ${slot}.`);

    const result = await this.pvmAccumulateInvocation(slot, serviceId, operands, gasCost, entropy, inputStateUpdate);

    if (result.isError) {
      logger.trace(`Accumulation failed for ${serviceId}.`);
      return { stateUpdate: null, consumedGas: gasCost };
    }

    logger.trace(`Accumulation successful for ${serviceId}.`);
    return result.ok;
  }

  /**
   * The outer accumulation function ∆+ which transforms a gas-limit, a sequence of work-reports,
   * an initial partial-state and a dictionary of services enjoying free accumulation,
   * into a tuple of the number of work-results accumulated, a posterior state-context,
   * the resultant deferred-transfers and accumulation-output pairing.
   *
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/179d00179d00?v=0.6.7
   */
  private async accumulateSequentially(
    gasLimit: ServiceGas,
    reports: WorkReport[],
    slot: TimeSlot,
    entropy: EntropyHash,
    statistics: Map<ServiceId, CountAndGasUsed>,
    stateUpdate: AccumulationStateUpdate,
  ): Promise<SequentialAccumulationResult> {
    const i = this.findReportCutoffIndex(gasLimit, reports);

    if (i === 0) {
      return {
        accumulatedReports: tryAsU32(0),
        gasCost: tryAsServiceGas(0),
        state: stateUpdate,
      };
    }

    const reportsToAccumulateInParallel = reports.slice(0, i);
    const autoAccumulateServices = this.state.privilegedServices.autoAccumulateServices;
    const accumulateData = new AccumulateData(reportsToAccumulateInParallel, autoAccumulateServices);
    const reportsToAccumulateSequentially = reports.slice(i);

    const {
      gasCost,
      state: stateAfterParallelAcc,
      ...rest
    } = await this.accumulateInParallel(accumulateData, slot, entropy, statistics, stateUpdate);
    assertEmpty(rest);

    // NOTE [ToDr] recursive invocation
    const {
      accumulatedReports,
      gasCost: seqGasCost,
      state,
      ...seqRest
    } = await this.accumulateSequentially(
      tryAsServiceGas(gasLimit - gasCost),
      reportsToAccumulateSequentially,
      slot,
      entropy,
      statistics,
      stateAfterParallelAcc,
    );
    assertEmpty(seqRest);

    return {
      accumulatedReports: tryAsU32(i + accumulatedReports),
      gasCost: tryAsServiceGas(gasCost + seqGasCost),
      state,
    };
  }

  /**
   * The parallelized accumulation function ∆∗ which,
   * with the help of the single-service accumulation function ∆1,
   * transforms an initial state-context, together with a sequence of work-reports
   * and a dictionary of privileged always-accumulate services,
   * into a tuple of the total gas utilized in pvm execution u, a posterior state-context
   * and the resultant accumulation-output pairings b and deferred-transfers.
   *
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/175501175501?v=0.6.7
   */
  private async accumulateInParallel(
    accumulateData: AccumulateData,
    slot: TimeSlot,
    entropy: EntropyHash,
    statistics: Map<ServiceId, CountAndGasUsed>,
    inputStateUpdate: AccumulationStateUpdate,
  ): Promise<ParallelAccumulationResult> {
    const serviceIds = accumulateData.getServiceIds();
    let gasCost: ServiceGas = tryAsServiceGas(0);
    let currentState = inputStateUpdate;

    for (const serviceId of serviceIds) {
      const checkpoint = AccumulationStateUpdate.copyFrom(currentState);
      const { consumedGas, stateUpdate } = await this.accumulateSingleService(
        serviceId,
        accumulateData.getOperands(serviceId),
        accumulateData.getGasCost(serviceId),
        slot,
        entropy,
        currentState,
      );

      gasCost = tryAsServiceGas(gasCost + consumedGas);

      const serviceStatistics = statistics.get(serviceId) ?? { count: tryAsU32(0), gasUsed: tryAsServiceGas(0) };
      serviceStatistics.count = tryAsU32(serviceStatistics.count + accumulateData.getReportsLength(serviceId));
      serviceStatistics.gasUsed = tryAsServiceGas(serviceStatistics.gasUsed + consumedGas);
      statistics.set(serviceId, serviceStatistics);
      currentState = stateUpdate === null ? checkpoint : stateUpdate;
    }

    return {
      state: currentState,
      gasCost,
    };
  }

  /**
   * A method that updates `recentlyAccumulated`, `accumulationQueue` and `timeslot` in state
   */
  private getAccumulationStateUpdate(
    accumulated: WorkReport[],
    toAccumulateLater: NotYetAccumulatedReport[],
    slot: TimeSlot,
    accumulatedServices: ServiceId[],
    servicesUpdate: ServicesUpdate,
  ): Pick<AccumulateStateUpdate, "recentlyAccumulated" | "accumulationQueue" | "timeslot"> & ServicesUpdate {
    const epochLength = this.chainSpec.epochLength;
    const phaseIndex = slot % epochLength;
    const accumulatedSet = getWorkPackageHashes(accumulated);
    const accumulatedSorted = Array.from(accumulatedSet).sort((a, b) => hashComparator(a, b).value);
    const newRecentlyAccumulated = this.state.recentlyAccumulated.slice(1).concat(HashSet.from(accumulatedSorted));

    const recentlyAccumulated = tryAsPerEpochBlock(newRecentlyAccumulated, this.chainSpec);
    const accumulationQueue = this.state.accumulationQueue.slice();
    accumulationQueue[phaseIndex] = pruneQueue(toAccumulateLater, accumulatedSet);

    for (let i = 1; i < epochLength; i++) {
      const queueIndex = (phaseIndex + epochLength - i) % epochLength;
      if (i < slot - this.state.timeslot) {
        accumulationQueue[queueIndex] = [];
      } else {
        accumulationQueue[queueIndex] = pruneQueue(accumulationQueue[queueIndex], accumulatedSet);
      }
    }

    // δ†
    const partialStateUpdate = new PartiallyUpdatedState(this.state, AccumulationStateUpdate.new(servicesUpdate));
    if (Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)) {
      // update last accumulation
      for (const serviceId of accumulatedServices) {
        // https://graypaper.fluffylabs.dev/#/7e6ff6a/181003185103?v=0.6.7
        const info = partialStateUpdate.getServiceInfo(serviceId);
        if (info === null) {
          // NOTE If there is no service, we dont update it.
          continue;
        }
        // δ‡
        partialStateUpdate.updateServiceInfo(serviceId, ServiceAccountInfo.create({ ...info, lastAccumulation: slot }));
      }
    }

    return {
      recentlyAccumulated,
      accumulationQueue: tryAsPerEpochBlock(accumulationQueue, this.chainSpec),
      timeslot: slot,
      ...partialStateUpdate.stateUpdate.services,
    };
  }

  /**
   * A method that calculates the initial gas limit.
   *
   * Please note it cannot overflow because we use `BigInt`, and the final result is clamped to `ACCUMULATE_TOTAL_GAS`.
   *
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/18f40118f401?v=0.6.7
   */
  private getGasLimit() {
    const calculatedGasLimit =
      GAS_TO_INVOKE_WORK_REPORT * BigInt(this.chainSpec.coresCount) +
      this.state.privilegedServices.autoAccumulateServices.reduce((acc, { gasLimit }) => acc + gasLimit, 0n);
    const gasLimit = tryAsServiceGas(
      ACCUMULATE_TOTAL_GAS > calculatedGasLimit ? ACCUMULATE_TOTAL_GAS : calculatedGasLimit,
    );

    return tryAsServiceGas(gasLimit);
  }

  async transition({ reports, slot, entropy }: AccumulateInput): Promise<Result<AccumulateResult, ACCUMULATION_ERROR>> {
    const statistics = new Map();
    const accumulateQueue = new AccumulateQueue(this.chainSpec, this.state);
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

    const { accumulatedReports, gasCost, state, ...rest } = await this.accumulateSequentially(
      gasLimit,
      accumulatableReports,
      slot,
      entropy,
      statistics,
      AccumulationStateUpdate.empty(),
    );
    assertEmpty(rest);

    const accumulated = accumulatableReports.slice(0, accumulatedReports);
    const {
      services,
      yieldedRoots,
      transfers,
      validatorsData,
      privilegedServices,
      authorizationQueues,
      ...stateUpdateRest
    } = state;
    assertEmpty(stateUpdateRest);

    const accStateUpdate = this.getAccumulationStateUpdate(
      accumulated,
      toAccumulateLater,
      slot,
      Array.from(statistics.keys()),
      services,
    );

    const rootHash = await getRootHash(Array.from(yieldedRoots.entries()));

    const authQueues = (() => {
      if (authorizationQueues.size === 0) {
        return {};
      }

      const updatedAuthQueues = this.state.authQueues.slice();
      for (const [core, queue] of authorizationQueues.entries()) {
        updatedAuthQueues[core] = queue;
      }
      return { authQueues: tryAsPerCore(updatedAuthQueues, this.chainSpec) };
    })();

    return Result.ok({
      root: rootHash,
      stateUpdate: {
        ...accStateUpdate,
        ...(validatorsData === null ? {} : { designatedValidatorData: validatorsData }),
        ...(privilegedServices === null ? {} : { privilegedServices: privilegedServices }),
        ...authQueues,
      },
      accumulationStatistics: statistics,
      pendingTransfers: transfers,
    });
  }
}

/**
 * Returns a new root hash
 *
 * https://graypaper.fluffylabs.dev/#/38c4e62/3c9d013c9d01?v=0.7.0
 */
async function getRootHash(yieldedRoots: [ServiceId, OpaqueHash][]): Promise<AccumulateRoot> {
  const keccakHasher = await KeccakHasher.create();
  const trieHasher = getKeccakTrieHasher(keccakHasher);
  const yieldedRootsSortedByServiceId = yieldedRoots.sort((a, b) => a[0] - b[0]);
  const values = yieldedRootsSortedByServiceId.map(([serviceId, hash]) => {
    return BytesBlob.blobFromParts([u32AsLeBytes(serviceId), hash.raw]);
  });

  return binaryMerkleization(values, trieHasher);
}
