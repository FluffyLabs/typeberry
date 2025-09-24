import {
  type EntropyHash,
  type ServiceGas,
  type ServiceId,
  type TimeSlot,
  tryAsPerEpochBlock,
  tryAsServiceGas,
} from "@typeberry/block";
import { W_C } from "@typeberry/block/gp-constants.js";
import type { WorkReport } from "@typeberry/block/work-report.js";
import { Bytes } from "@typeberry/bytes";
import { codec, Encoder } from "@typeberry/codec";
import { HashSet, SortedArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import {
  AccumulationStateUpdate,
  PartiallyUpdatedState,
} from "@typeberry/jam-host-calls/externalities/state-update.js";
import { Logger } from "@typeberry/logger";
import { tryAsU32, type U32 } from "@typeberry/numbers";
import { tryAsGas } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status.js";
import {
  type AccumulationOutput,
  accumulationOutputComparator,
  hashComparator,
  PrivilegedServices,
  ServiceAccountInfo,
  type ServicesUpdate,
  tryAsPerCore,
} from "@typeberry/state";
import type { NotYetAccumulatedReport } from "@typeberry/state/not-yet-accumulated.js";
import { assertEmpty, Compatibility, GpVersion, Result } from "@typeberry/utils";
import { AccumulateExternalities } from "../externalities/accumulate-externalities.js";
import { FetchExternalities } from "../externalities/index.js";
import type { CountAndGasUsed } from "../statistics.js";
import { AccumulateData } from "./accumulate-data.js";
import { AccumulateQueue, pruneQueue } from "./accumulate-queue.js";
import {
  type AccumulateInput,
  type AccumulateResult,
  type AccumulateState,
  type AccumulateStateUpdate,
  GAS_TO_INVOKE_WORK_REPORT,
} from "./accumulate-state.js";
import { generateNextServiceId, getWorkPackageHashes } from "./accumulate-utils.js";
import type { Operand } from "./operand.js";
import { PvmExecutor } from "./pvm-executor.js";

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
  PreimageTooLong = 2,
}

const logger = Logger.new(import.meta.filename, "accumulate");

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

    if (code.length > W_C) {
      logger.log(`Code with hash ${codeHash} is too long for service ${serviceId}.`);
      return Result.error(PvmInvocationError.PreimageTooLong);
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
    const args = Encoder.encodeObject(ARGS_CODEC, { slot, serviceId, operands: tryAsU32(operands.length) });
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
        logger.trace(`[${serviceId}] accumulate finished with ${Status[status]} reverting to checkpoint.`);
        return Result.ok({ stateUpdate: checkpoint, consumedGas: tryAsServiceGas(result.consumedGas) });
      }

      logger.trace(`[${serviceId}] accumulate finished with ${Status[status]}`);
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
    logger.log(`Accumulating service ${serviceId}, items: ${operands.length} at slot: ${slot}.`);

    const result = await this.pvmAccumulateInvocation(slot, serviceId, operands, gasCost, entropy, inputStateUpdate);

    if (result.isError) {
      // https://graypaper.fluffylabs.dev/#/7e6ff6a/2fb6012fb601?v=0.6.7
      logger.log(`Accumulation failed for ${serviceId}.`);
      return { stateUpdate: null, consumedGas: 0n };
    }

    logger.log(`Accumulation successful for ${serviceId}. Consumed: ${result.ok.consumedGas}`);
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
    const currentManager = (inputStateUpdate.privilegedServices ?? this.state.privilegedServices).manager;

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

      if (Compatibility.is(GpVersion.V0_7_0) && serviceId === currentManager) {
        const newV = currentState.privilegedServices?.validatorsManager;
        if (currentState.privilegedServices !== null && newV !== undefined && serviceIds.includes(newV)) {
          logger.info(
            "Entering completely incorrect code that probably reverts validatorsManager change. This is valid in 0.7.0 only and incorrect in 0.7.1+",
          );
          // Since serviceIds already contains newV, this service gets accumulated twice.
          // To avoid double-counting, we skip stats and gas cost tracking here.
          // We need this accumulation to get the correct `validatorsManager`
          const { stateUpdate } = await this.accumulateSingleService(
            newV,
            accumulateData.getOperands(newV),
            accumulateData.getGasCost(newV),
            slot,
            entropy,
            checkpoint,
          );

          const correctV =
            stateUpdate?.privilegedServices?.validatorsManager ?? this.state.privilegedServices.validatorsManager;
          currentState.privilegedServices = PrivilegedServices.create({
            ...currentState.privilegedServices,
            validatorsManager: correctV,
          });
        }
      }
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
  ): Pick<AccumulateStateUpdate, "timeslot" | "recentlyAccumulated" | "accumulationQueue"> & ServicesUpdate {
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

    return {
      recentlyAccumulated,
      timeslot: slot,
      accumulationQueue: tryAsPerEpochBlock(accumulationQueue, this.chainSpec),
      ...partialStateUpdate.stateUpdate.services,
    };
  }

  /**
   * A method that calculates the initial gas limit.
   *
   * Please note it cannot overflow because we use `BigInt`, and the final result is clamped to `maxBlockGas` (W_G).
   *
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/18f40118f401?v=0.6.7
   */
  private getGasLimit() {
    const calculatedGasLimit =
      GAS_TO_INVOKE_WORK_REPORT * BigInt(this.chainSpec.coresCount) +
      this.state.privilegedServices.autoAccumulateServices.reduce((acc, { gasLimit }) => acc + gasLimit, 0n);
    const gasLimit = tryAsServiceGas(
      this.chainSpec.maxBlockGas > calculatedGasLimit ? this.chainSpec.maxBlockGas : calculatedGasLimit,
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
    // we can safely ignore top-level gas cost from accSequentially.
    const _gasCost = gasCost;
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

    const accumulationOutputUnsorted: AccumulationOutput[] = Array.from(yieldedRoots.entries()).map(
      ([serviceId, root]) => {
        return { serviceId, output: root.asOpaque() };
      },
    );
    const accumulationOutput = SortedArray.fromArray(accumulationOutputComparator, accumulationOutputUnsorted);
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
      stateUpdate: {
        ...accStateUpdate,
        ...(validatorsData === null ? {} : { designatedValidatorData: validatorsData }),
        ...(privilegedServices === null ? {} : { privilegedServices: privilegedServices }),
        ...authQueues,
      },
      accumulationStatistics: statistics,
      pendingTransfers: transfers,
      accumulationOutputLog: accumulationOutput,
    });
  }
}
