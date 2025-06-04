import {
  type EntropyHash,
  type ServiceGas,
  type ServiceId,
  type TimeSlot,
  tryAsPerEpochBlock,
  tryAsServiceGas,
} from "@typeberry/block";
import type { WorkReport } from "@typeberry/block/work-report";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Encoder, codec } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";

import { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants";
import { FixedSizeArray, HashSet } from "@typeberry/collections";
import { KeccakHasher } from "@typeberry/hash/keccak";
import { PartialStateDb } from "@typeberry/jam-host-calls/externalities/partial-state-db";
import type { PendingTransfer } from "@typeberry/jam-host-calls/externalities/pending-transfer";
import type { StateUpdate } from "@typeberry/jam-host-calls/externalities/state-update";
import { Logger } from "@typeberry/logger";
import { type U32, tryAsU32, u32AsLeBytes } from "@typeberry/numbers";
import { tryAsGas } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status";
import {
  AutoAccumulate,
  LookupHistoryItem,
  PrivilegedServices,
  type State,
  hashComparator,
  tryAsPerCore,
} from "@typeberry/state";
import type { NotYetAccumulatedReport } from "@typeberry/state/not-yet-accumulated";
import { InMemoryTrie } from "@typeberry/trie";
import { getKeccakTrieHasher } from "@typeberry/trie/hasher";
import { type MutablePick, Result } from "@typeberry/utils";
import { AccumulateQueue, pruneQueue } from "./accumulate-queue";
import { generateNextServiceId, getWorkPackageHashes, uniquePreserveOrder } from "./accumulate-utils";
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
  entropy: EntropyHash;
  designatedValidatorData?: State["designatedValidatorData"];
  authQueues?: State["authQueues"];
} & MutablePick<State, "privilegedServices" | "recentlyAccumulated" | "accumulationQueue" | "timeslot" | "services">;

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

const ARGS_CODEC = codec.object({
  slot: codec.u32.asOpaque<TimeSlot>(),
  serviceId: codec.u32.asOpaque<ServiceId>(),
  operands: codec.sequenceVarLen(Operand.Codec),
});

export class Accumulate {
  constructor(
    public readonly state: AccumulateState,
    public readonly chainSpec: ChainSpec,
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

    const nextServiceId = generateNextServiceId(
      { serviceId, entropy: this.state.entropy, timeslot: slot },
      this.chainSpec,
    );
    const partialState = new PartialStateDb(
      { services: this.state.services, timeslot: slot },
      serviceId,
      nextServiceId,
    );

    const externalities = {
      partialState,
      fetchExternalities: new AccumulateFetchExternalities(this.state.entropy, operands, this.chainSpec),
      accountsInfo: new AccountsInfoExternalities(this.state.services),
      accountsRead: new AccountsReadExternalities(),
      accountsWrite: new AccountsWriteExternalities(),
      accountsLookup: new AccountsLookupExternalities(),
    };

    const executor = PvmExecutor.createAccumulateExecutor(code.blob, externalities, this.chainSpec);
    const args = Encoder.encodeObject(ARGS_CODEC, { slot, serviceId, operands }, this.chainSpec);

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
     * PVM invocation returned a hash so we save it in partial state
     *
     * https://graypaper.fluffylabs.dev/#/7e6ff6a/301202301202?v=0.6.7
     */
    if (result.hasMemorySlice() && result.memorySlice.length === HASH_SIZE) {
      const memorySlice = Bytes.fromBlob(result.memorySlice, HASH_SIZE);
      newState.yieldedRoot = memorySlice.asOpaque();
    }

    /**
     * Everything was okay so we can return a new state
     *
     * https://graypaper.fluffylabs.dev/#/7e6ff6a/302302302302?v=0.6.7
     */
    return Result.ok({ stateUpdate: newState, consumedGas: tryAsServiceGas(result.consumedGas) });
  }

  /**
   * A method that prepare operands array and gas cost that are needed to accumulate a single service.
   *
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/18ea00189d01?v=0.6.7
   */
  private getOperandsAndGasCost(serviceId: ServiceId, reports: WorkReport[]) {
    let gasCost =
      this.state.privilegedServices.autoAccumulateServices.find((x) => x.service === serviceId)?.gasLimit ??
      tryAsServiceGas(0n);

    const operands: Operand[] = [];

    for (const report of reports) {
      const results = report.results.filter((result) => result.serviceId === serviceId);

      for (const result of results) {
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

    return { operands, gasCost };
  }

  /**
   * A method that accumulate reports connected with a single service
   *
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/18d70118d701?v=0.6.7
   */
  private async accumulateSingleService(serviceId: ServiceId, reports: WorkReport[], slot: TimeSlot) {
    const { operands, gasCost } = this.getOperandsAndGasCost(serviceId, reports);

    const result = await this.pvmAccumulateInvocation(slot, serviceId, operands, gasCost);

    if (result.isError) {
      return { stateUpdate: null, consumedGas: gasCost };
    }

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
  private async accumulateInParallel(reports: WorkReport[], slot: TimeSlot): Promise<ParallelAccumulationResult> {
    const autoAccumulateServiceIds = this.state.privilegedServices.autoAccumulateServices.map(({ service }) => service);
    const allServiceIds = reports
      .flatMap((report) => report.results.map((result) => result.serviceId))
      .concat(Array.from(autoAccumulateServiceIds));
    const serviceIds = uniquePreserveOrder(autoAccumulateServiceIds.concat(allServiceIds));

    const stateUpdates: [ServiceId, StateUpdate][] = [];
    const gasCosts: [ServiceId, ServiceGas][] = [];
    const yieldedRoots: [ServiceId, OpaqueHash][] = [];
    const pendingTransfers: [ServiceId, PendingTransfer[]][] = [];

    for (const serviceId of serviceIds) {
      const { consumedGas, stateUpdate } = await this.accumulateSingleService(serviceId, reports, slot);

      gasCosts.push([serviceId, tryAsServiceGas(consumedGas)]);

      if (stateUpdate === null) {
        continue;
      }

      stateUpdates.push([serviceId, stateUpdate]);
      pendingTransfers.push([serviceId, stateUpdate.transfers]);

      if (stateUpdate.yieldedRoot !== null) {
        yieldedRoots.push([serviceId, stateUpdate.yieldedRoot]);
      }
    }

    this.applyStateUpdates(stateUpdates, slot);

    return {
      pendingTransfers,
      yieldedRoots,
      gasCosts,
    };
  }

  /**
   * A method that applies changes that were made by services.
   * It can modify: `services`, `privilegedServices`, `authQueues`,
   * and `designatedValidatorData` and is called after parallel accumulation step.
   */
  private applyStateUpdates(stateUpdates: [ServiceId, StateUpdate][], slot: TimeSlot): void {
    const { authManager, manager, validatorsManager } = this.state.privilegedServices;
    for (const [serviceId, stateUpdate] of stateUpdates) {
      if (serviceId === manager && stateUpdate.priviledgedServices !== null) {
        const priviledgedServices = stateUpdate.priviledgedServices;

        this.state.privilegedServices = PrivilegedServices.create({
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
          this.state.authQueues[coreIndex] = FixedSizeArray.new(
            authQueue.map((hash) => hash.asOpaque()),
            AUTHORIZATION_QUEUE_SIZE,
          );
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

      /**
       * Integrate provided premiages
       *
       * https://graypaper.fluffylabs.dev/#/7e6ff6a/17b80217b802?v=0.6.7
       */
      for (const { item, serviceId } of stateUpdate.providedPreimages) {
        const { blob, hash } = item;
        const lookupHistoryItem = this.state.services
          .get(serviceId)
          ?.data.lookupHistory.get(hash)
          ?.find(({ length }) => length === blob.length);

        if (lookupHistoryItem?.slots !== undefined && LookupHistoryItem.isRequested(lookupHistoryItem)) {
          lookupHistoryItem.slots.push(slot);
          this.state.services.get(serviceId)?.data.preimages.set(hash, item);
        }
      }
    }
  }

  /**
   * A method that updates `recentlyAccumulated`, `accumulationQueue` and `timeslot` in state
   */
  private updateState(accumulated: WorkReport[], toAccumulateLater: NotYetAccumulatedReport[], slot: TimeSlot) {
    const epochLength = this.chainSpec.epochLength;
    const phaseIndex = slot % epochLength;
    const accumulatedSet = getWorkPackageHashes(accumulated);
    const accumulatedSorted = Array.from(accumulatedSet).sort((a, b) => hashComparator(a, b).value);
    const newRecentlyAccumulated = this.state.recentlyAccumulated.slice(1).concat(HashSet.from(accumulatedSorted));
    this.state.recentlyAccumulated = tryAsPerEpochBlock(newRecentlyAccumulated, this.chainSpec);
    this.state.accumulationQueue[phaseIndex] = pruneQueue(toAccumulateLater, accumulatedSet);

    for (let i = 1; i < epochLength; i++) {
      if (i < slot - this.state.timeslot) {
        this.state.accumulationQueue[(phaseIndex + epochLength - i) % epochLength] = [];
      } else {
        const queueIndex = (phaseIndex + epochLength - i) % epochLength;
        this.state.accumulationQueue[queueIndex] = pruneQueue(this.state.accumulationQueue[queueIndex], accumulatedSet);
      }
    }

    this.state.timeslot = slot;
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

  async transition({ reports, slot }: AccumulateInput): Promise<AccumulateRoot> {
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
    return rootHash;
  }
}

/**
 * Retruns a new root hash
 *
 * This function probably doesn't work correctly, since the current test vectors don't verify the root hash.
 */
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
