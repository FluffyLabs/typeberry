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
import { ArrayView, HashSet, SortedArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { PVMInterpreter } from "@typeberry/config-node";
import { type Blake2b, HASH_SIZE } from "@typeberry/hash";
import type { PendingTransfer } from "@typeberry/jam-host-calls";
import {
  AccumulationStateUpdate,
  PartiallyUpdatedState,
} from "@typeberry/jam-host-calls/externalities/state-update.js";
import { Logger } from "@typeberry/logger";
import { sumU64, tryAsU32, type U32 } from "@typeberry/numbers";
import { tryAsGas } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status.js";
import {
  type AccumulationOutput,
  type AutoAccumulate,
  accumulationOutputComparator,
  hashComparator,
  type NotYetAccumulatedReport,
  PrivilegedServices,
  ServiceAccountInfo,
  type ServicesUpdate,
  tryAsPerCore,
} from "@typeberry/state";
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
  argsLength: codec.varU32,
});

export class Accumulate {
  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly blake2b: Blake2b,
    public readonly state: AccumulateState,
    public readonly pvmInterpreter: PVMInterpreter = PVMInterpreter.Default,
  ) {}

  /**
   * Returns an index that determines how many WorkReports can be processed before exceeding a given gasLimit.
   *
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/170a01170a01?v=0.6.7
   */
  private findReportCutoffIndex(gasLimit: ServiceGas, reports: ArrayView<WorkReport>) {
    const reportsLength = reports.length;
    let currentGas = 0n;

    for (let i = 0; i < reportsLength; i++) {
      const report = reports.get(i);
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
    transfers: PendingTransfer[],
    operands: Operand[],
    gas: ServiceGas,
    entropy: EntropyHash,
    updatedState: PartiallyUpdatedState,
  ): Promise<Result<InvocationResult, PvmInvocationError>> {
    const serviceInfo = updatedState.getServiceInfo(serviceId);
    if (serviceInfo === null) {
      logger.log`Service with id ${serviceId} not found.`;
      return Result.error(PvmInvocationError.NoService, () => `Accumulate: service ${serviceId} not found`);
    }

    const codeHash = serviceInfo.codeHash;
    // TODO [ToDr] Should we check that the preimage is still available?
    const code = updatedState.getPreimage(serviceId, codeHash.asOpaque());

    if (code === null) {
      logger.log`Code with hash ${codeHash} not found for service ${serviceId}.`;
      return Result.error(
        PvmInvocationError.NoPreimage,
        () => `Accumulate: code with hash ${codeHash} not found for service ${serviceId}`,
      );
    }

    if (code.length > W_C) {
      logger.log`Code with hash ${codeHash} is too long for service ${serviceId}.`;
      return Result.error(
        PvmInvocationError.PreimageTooLong,
        () => `Accumulate: code length ${code.length} exceeds max ${W_C} for service ${serviceId}`,
      );
    }

    const nextServiceId = generateNextServiceId({ serviceId, entropy, timeslot: slot }, this.chainSpec, this.blake2b);
    const partialState = new AccumulateExternalities(
      this.chainSpec,
      this.blake2b,
      updatedState,
      serviceId,
      nextServiceId,
      slot,
    );

    const fetchExternalities = Compatibility.isGreaterOrEqual(GpVersion.V0_7_1)
      ? FetchExternalities.createForAccumulate({ entropy, transfers, operands }, this.chainSpec)
      : FetchExternalities.createForPre071Accumulate({ entropy, operands }, this.chainSpec);

    const externalities = {
      partialState,
      serviceExternalities: partialState,
      fetchExternalities,
    };

    const executor = PvmExecutor.createAccumulateExecutor(
      serviceId,
      code,
      externalities,
      this.chainSpec,
      this.pvmInterpreter,
    );
    const invocationArgs = Encoder.encodeObject(ARGS_CODEC, {
      slot,
      serviceId,
      argsLength: tryAsU32(transfers.length + operands.length),
    });
    const result = await executor.run(invocationArgs, tryAsGas(gas));
    const [newState, checkpoint] = partialState.getStateUpdates();

    /**
     * PVM invocation returned and error so we return the checkpoint
     *
     * https://graypaper.fluffylabs.dev/#/7e6ff6a/300002300002?v=0.6.7
     */
    if (result.hasStatus()) {
      const status = result.status;
      if (status === Status.OOG || status === Status.PANIC) {
        logger.trace`[${serviceId}] accumulate finished with ${Status[status]} reverting to checkpoint.`;
        return Result.ok({ stateUpdate: checkpoint, consumedGas: tryAsServiceGas(result.consumedGas) });
      }

      logger.trace`[${serviceId}] accumulate finished with ${Status[status]}`;
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
    transfers: PendingTransfer[],
    operands: Operand[],
    gasCost: ServiceGas,
    slot: TimeSlot,
    entropy: EntropyHash,
    inputStateUpdate: AccumulationStateUpdate,
  ) {
    logger.log`Accumulating service ${serviceId}, transfers: ${transfers.length} operands: ${operands.length} at slot: ${slot}.`;

    const updatedState = new PartiallyUpdatedState(this.state, inputStateUpdate);

    // update service balance from incoming transfers
    if (Compatibility.isGreaterOrEqual(GpVersion.V0_7_1)) {
      const serviceInfo = updatedState.getServiceInfo(serviceId);
      if (serviceInfo !== null) {
        // update the balance from incoming tranfsers
        const newBalance = sumU64(serviceInfo.balance, ...transfers.map((item) => item.amount));

        if (newBalance.overflow) {
          logger.log`Accumulation failed because of overflowing balance ${serviceId}.`;
          return { stateUpdate: null, consumedGas: 0n };
        }

        const newInfo = ServiceAccountInfo.create({ ...serviceInfo, balance: newBalance.value });
        updatedState.updateServiceInfo(serviceId, newInfo);
      }
    }

    const result = await this.pvmAccumulateInvocation(
      slot,
      serviceId,
      transfers,
      operands,
      gasCost,
      entropy,
      updatedState,
    );

    if (result.isError) {
      // https://graypaper.fluffylabs.dev/#/ab2cdbd/2fc9032fc903?v=0.7.2
      logger.log`Accumulation failed for ${serviceId}.`;
      // even though accumulation failed, we still need to make sure that
      // incoming transfers updated the balance, hence we pass state update here
      return { stateUpdate: updatedState.stateUpdate, consumedGas: 0n };
    }

    logger.log`Accumulation successful for ${serviceId}. Consumed: ${result.ok.consumedGas}`;
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
  private async accumulateSequentiallyLegacy(
    gasLimit: ServiceGas,
    reports: ArrayView<WorkReport>,
    slot: TimeSlot,
    entropy: EntropyHash,
    statistics: Map<ServiceId, CountAndGasUsed>,
    stateUpdate: AccumulationStateUpdate,
    autoAccumulateServices: readonly AutoAccumulate[],
  ): Promise<SequentialAccumulationResult> {
    const i = this.findReportCutoffIndex(gasLimit, reports);

    if (i === 0) {
      return {
        accumulatedReports: tryAsU32(0),
        gasCost: tryAsServiceGas(0),
        state: stateUpdate,
      };
    }

    const reportsToAccumulateInParallel = reports.subview(0, i);
    const accumulateData = new AccumulateData(reportsToAccumulateInParallel, [], autoAccumulateServices);
    const reportsToAccumulateSequentially = reports.subview(i);

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
    } = await this.accumulateSequentiallyLegacy(
      tryAsServiceGas(gasLimit - gasCost),
      reportsToAccumulateSequentially,
      slot,
      entropy,
      statistics,
      stateAfterParallelAcc,
      [],
    );
    assertEmpty(seqRest);

    return {
      accumulatedReports: tryAsU32(i + accumulatedReports),
      gasCost: tryAsServiceGas(gasCost + seqGasCost),
      state,
    };
  }

  /**
   * The outer accumulation function ∆+ which transforms a gas-limit, a sequence of work-reports,
   * an initial partial-state and a dictionary of services enjoying free accumulation,
   * into a tuple of the number of work-results accumulated, a posterior state-context,
   * the resultant deferred-transfers and accumulation-output pairing.
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/172901172901?v=0.7.2
   */
  private async accumulateSequentially(
    gasLimit: ServiceGas,
    reports: ArrayView<WorkReport>,
    transfers: PendingTransfer[],
    slot: TimeSlot,
    entropy: EntropyHash,
    statistics: Map<ServiceId, CountAndGasUsed>,
    stateUpdate: AccumulationStateUpdate,
    autoAccumulateServices: readonly AutoAccumulate[],
  ): Promise<SequentialAccumulationResult> {
    const i = this.findReportCutoffIndex(gasLimit, reports);

    const n = transfers.length + i + reports.length;

    if (n === 0) {
      return {
        accumulatedReports: tryAsU32(0),
        gasCost: tryAsServiceGas(0),
        state: stateUpdate,
      };
    }

    const reportsToAccumulateInParallel = reports.subview(0, i);
    const accumulateData = new AccumulateData(reportsToAccumulateInParallel, transfers, autoAccumulateServices);
    const reportsToAccumulateSequentially = reports.subview(i);

    const {
      gasCost,
      state: stateAfterParallelAcc,
      ...rest
    } = await this.accumulateInParallel(accumulateData, slot, entropy, statistics, stateUpdate);
    const newTransfers = stateAfterParallelAcc.takeTransfers();
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
      newTransfers,
      slot,
      entropy,
      statistics,
      stateAfterParallelAcc,
      [],
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
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/174602174602?v=0.7.2
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
      const operands = accumulateData.getOperands(serviceId);
      const { consumedGas, stateUpdate } = await this.accumulateSingleService(
        serviceId,
        accumulateData.getTransfers(serviceId),
        operands,
        accumulateData.getGasCost(serviceId),
        slot,
        entropy,
        currentState,
      );

      gasCost = tryAsServiceGas(gasCost + consumedGas);

      // https://graypaper.fluffylabs.dev/#/ab2cdbd/193b05193b05?v=0.7.2
      const serviceStatistics = statistics.get(serviceId) ?? { count: tryAsU32(0), gasUsed: tryAsServiceGas(0) };
      const count = accumulateData.getReportsLength(serviceId);

      // [0.7.1]: do not update statistics, if the service only had incoming transfers
      if (
        (Compatibility.isLessThan(GpVersion.V0_7_2) && count > 0) ||
        (Compatibility.isGreaterOrEqual(GpVersion.V0_7_2) && (count > 0 || consumedGas > 0n))
      ) {
        serviceStatistics.count = tryAsU32(serviceStatistics.count + count);
        serviceStatistics.gasUsed = tryAsServiceGas(serviceStatistics.gasUsed + consumedGas);
        statistics.set(serviceId, serviceStatistics);
      }
      currentState = stateUpdate === null ? checkpoint : stateUpdate;

      if (Compatibility.is(GpVersion.V0_7_0) && serviceId === currentManager) {
        const newV = currentState.privilegedServices?.delegator;
        if (currentState.privilegedServices !== null && newV !== undefined && serviceIds.includes(newV)) {
          logger.info`Entering completely incorrect code that probably reverts delegator change. This is valid in 0.7.0 only and incorrect in 0.7.1+`;
          // Since serviceIds already contains newV, this service gets accumulated twice.
          // To avoid double-counting, we skip stats and gas cost tracking here.
          // We need this accumulation to get the correct `delegator`
          const { stateUpdate } = await this.accumulateSingleService(
            newV,
            [],
            accumulateData.getOperands(newV),
            accumulateData.getGasCost(newV),
            slot,
            entropy,
            checkpoint,
          );

          const correctV = stateUpdate?.privilegedServices?.delegator ?? this.state.privilegedServices.delegator;
          currentState.privilegedServices = PrivilegedServices.create({
            ...currentState.privilegedServices,
            delegator: correctV,
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

    const timeslot = this.state.timeslot;
    for (let i = 1; i < epochLength; i++) {
      const queueIndex = (phaseIndex + epochLength - i) % epochLength;
      if (i < slot - timeslot) {
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
        logger.log`Skipping update of ${serviceId}, because we have no service info.`;
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
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/183402184502?v=0.7.2
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

  /**
   * Detects the very unlikely situation where multiple services are created with the same ID.
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/30f20330f403?v=0.7.2
   *
   * NOTE: This is public only for testing purposes and should not be used outside of accumulation.
   */
  public hasDuplicatedServiceIdCreated(createdIds: ServiceId[]): boolean {
    const uniqueIds = new Set(createdIds);
    return uniqueIds.size !== createdIds.length;
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
    const accumulatableReports = ArrayView.from(toAccumulateImmediately.concat(queue));

    const gasLimit = this.getGasLimit();
    const autoAccumulateServices = this.state.privilegedServices.autoAccumulateServices;

    const { accumulatedReports, gasCost, state, ...rest } = Compatibility.isGreaterOrEqual(GpVersion.V0_7_1)
      ? await this.accumulateSequentially(
          gasLimit,
          accumulatableReports,
          [],
          slot,
          entropy,
          statistics,
          AccumulationStateUpdate.empty(),
          autoAccumulateServices,
        )
      : await this.accumulateSequentiallyLegacy(
          gasLimit,
          accumulatableReports,
          slot,
          entropy,
          statistics,
          AccumulationStateUpdate.empty(),
          autoAccumulateServices,
        );
    // we can safely ignore top-level gas cost from accSequentially.
    const _gasCost = gasCost;
    assertEmpty(rest);

    const accumulated = accumulatableReports.subview(0, accumulatedReports);
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

    if (this.hasDuplicatedServiceIdCreated(services.created)) {
      logger.trace`Duplicated Service creation detected. Block is invalid.`;
      return Result.error(ACCUMULATION_ERROR, () => "Accumulate: duplicate service created");
    }

    const accStateUpdate = this.getAccumulationStateUpdate(
      accumulated.toArray(),
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
