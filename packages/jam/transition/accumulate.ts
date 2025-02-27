import { type EntropyHash, type ServiceGas, type ServiceId, type TimeSlot, tryAsServiceGas } from "@typeberry/block";
import type { WorkPackageHash, WorkReport } from "@typeberry/block/work-report";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Encoder, codec } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";

import { G_A, G_T } from "@typeberry/block/gp-constants";
import { HashSet, SortedSet } from "@typeberry/collections";
import { KeccakHasher } from "@typeberry/hash/keccak";
import { PartialStateDb } from "@typeberry/jam-host-calls/externalities/partial-state-db";
import type { PendingTransfer } from "@typeberry/jam-host-calls/externalities/pending-transfer";
import type { StateUpdate } from "@typeberry/jam-host-calls/externalities/state-update";
import { type U32, tryAsU32, u32AsLeBytes } from "@typeberry/numbers";
import { tryAsGas } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status";
import {
  AutoAccumulate,
  PrivilegedServices,
  type Service,
  type State,
  hashComparator,
  tryAsPerCore,
} from "@typeberry/state";
import { InMemoryTrie } from "@typeberry/trie";
import { getKeccakTrieHasher } from "@typeberry/trie/hasher";
import { Result } from "@typeberry/utils";
import {
  AccountsInfoExternalities,
  AccountsLookupExternalities,
  AccountsReadExternalities,
  AccountsWriteExternalities,
  AccumulateFetchExternalities,
} from "./accumulate/externalities";
import { Operand } from "./accumulate/operand";
import { PvmExecutor } from "./accumulate/pvm-executor";

export type AccumulateRoot = OpaqueHash;

export type AccumulateInput = {
  slot: TimeSlot;
  reports: WorkReport[];
};

export type QueueItem = {
  report: WorkReport;
  dependencies: WorkPackageHash[];
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

export class Accumulate {
  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly state: AccumulateState,
  ) {}

  private getWorkReportsToAccumulateImmediately(reports: WorkReport[]): WorkReport[] {
    return reports.filter((report) => {
      return report.context.prerequisites.length === 0 && report.segmentRootLookup.length === 0;
    });
  }

  private removeDeps(reports: QueueItem[], depsToRemove: WorkPackageHash[]) {
    return reports
      .filter(({ report }) => depsToRemove.find((hash) => hash.isEqualTo(report.workPackageSpec.hash)) === undefined)
      .map((item) => {
        const { report, dependencies } = item;
        return {
          report,
          dependencies: dependencies.filter(
            (dependency) => depsToRemove.find((historyItem) => historyItem.isEqualTo(dependency)) === undefined,
          ),
        };
      });
  }

  private getWorkReportDependencies(report: WorkReport): WorkPackageHash[] {
    return report.context.prerequisites.concat(report.segmentRootLookup.map((x) => x.workPackageHash));
  }

  private getWorkReportsToAccumulateLater(reports: WorkReport[]): QueueItem[] {
    const history = this.state.accumulated.flat();
    const reportsWithDependencies = reports.filter(
      (report) => report.context.prerequisites.length > 0 || report.segmentRootLookup.length > 0,
    );

    const itemsToEnqueue = reportsWithDependencies.map<QueueItem>((report) => ({
      report,
      dependencies: this.getWorkReportDependencies(report),
    }));

    return this.removeDeps(itemsToEnqueue, history);
  }

  enqueueReports(r: QueueItem[]): WorkReport[] {
    const result: WorkReport[] = [];
    let queue = [...r];

    while (queue.length > 0) {
      const ready = queue.filter(({ dependencies }) => dependencies.length === 0).map(({ report }) => report);

      if (ready.length === 0) {
        return result;
      }

      result.push(...ready);

      const readyHashes = this.getWorkPackageHashes(ready);

      queue = this.removeDeps(queue, readyHashes);
    }

    return result;
  }

  getWorkPackageHashes(reports: WorkReport[]) {
    const workPackageHashes = reports.map((report) => report.workPackageSpec.hash);
    const uniqueHashes = HashSet.from(workPackageHashes);
    const uniqueSortedHashes = SortedSet.fromArray(hashComparator, Array.from(uniqueHashes));
    return uniqueSortedHashes.array;
  }

  getQueueFromState(slot: TimeSlot) {
    const m = slot % this.chainSpec.epochLength;
    const fromMToEnd = this.state.readyQueue.slice(m);
    const fromStartToM = this.state.readyQueue.slice(0, m);
    return fromMToEnd.concat(fromStartToM).flat();
  }

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
    partialState: PartialStateDb,
  ): Promise<InvocationResult> {
    const service = this.state.services.get(serviceId);
    if (service === undefined) {
      // TODO [MaSi]: to handle
      throw new Error("no service");
    }

    const codeHash = service.data.info.codeHash;
    const code = service.data.preimages.get(codeHash.asOpaque());
    if (code === undefined) {
      // TODO [MaSi]: to handle
      throw new Error("no preimage");
    }

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
        return { stateUpdate: checkpoint, consumedGas: tryAsServiceGas(result.consumedGas) };
      }
    }

    if (result.hasMemorySlice() && result.statusOrMemorySlice.length === HASH_SIZE) {
      const memorySlice = Bytes.fromBlob(result.statusOrMemorySlice, HASH_SIZE);
      newState.yieldedRoot = memorySlice.asOpaque();
    }

    return { stateUpdate: newState, consumedGas: tryAsServiceGas(result.consumedGas) };
  }

  accumulateSingleService(serviceId: ServiceId, reports: WorkReport[], slot: TimeSlot) {
    // TODO [MaSi]: everything here should be `ServiceGas`
    if (this.state.services.get(serviceId) === undefined) {
      return { stateUpdate: null, consumedGas: 0n };
    }
    const partialState = new PartialStateDb({ services: this.state.services, timeslot: slot }, serviceId);

    let gasCost = tryAsServiceGas(
      this.state.privileges.autoAccumulateServices.find((x) => x.service === serviceId)?.gasLimit ?? 0n,
    );
    const operands: Operand[] = [];

    for (const report of reports) {
      for (const result of report.results) {
        if (result.serviceId === serviceId) {
          gasCost = tryAsServiceGas(gasCost + tryAsServiceGas(result.gas));

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

    return this.pvmAccumulateInvocation(slot, serviceId, operands, gasCost, partialState);
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

      // TODO [MaSi]: eject

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

    const { authManager, manager, validatorsManager } = this.state.privileges;

    const newPriviledgedServices =
      (await this.accumulateSingleService(manager, reports, slot)).stateUpdate?.priviledgedServices ?? null;

    const validatorsData =
      (await this.accumulateSingleService(validatorsManager, reports, slot)).stateUpdate?.validatorsData ?? null;

    const authorizationQueues =
      (await this.accumulateSingleService(authManager, reports, slot)).stateUpdate?.authorizationQueues ?? null;

    if (newPriviledgedServices !== null) {
      this.state.privileges = PrivilegedServices.create({
        manager: newPriviledgedServices.manager,
        authManager: newPriviledgedServices.authorizer,
        validatorsManager: newPriviledgedServices.validators,
        autoAccumulateServices: newPriviledgedServices.autoAccumulate.map(([service, gasLimit]) =>
          AutoAccumulate.create({ gasLimit, service }),
        ),
      });
    }

    if (validatorsData !== null) {
      this.state.designatedValidatorData = validatorsData;
    }

    if (authorizationQueues !== null) {
      if (this.state.authQueues === undefined) {
        const queue = new Array(this.chainSpec.coresCount);
        queue.fill([]);
        this.state.authQueues = tryAsPerCore(queue, this.chainSpec);
      }

      for (const [coreIndex, authQueue] of authorizationQueues) {
        this.state.authQueues[coreIndex].push(...authQueue.map((hash) => hash.asOpaque()));
      }
    }

    return {
      pendingTransfers,
      yieldedRoots,
      gasCosts,
    };
  }

  async transition({ reports, slot }: AccumulateInput): Promise<Result<AccumulateRoot, never>> {
    const toAccumulateImmediately = this.getWorkReportsToAccumulateImmediately(reports);
    const toAccumulateLater = this.getWorkReportsToAccumulateLater(reports);
    const queueFromState = this.getQueueFromState(slot);

    const toEnqueue = this.removeDeps(
      queueFromState.concat(toAccumulateLater),
      this.getWorkPackageHashes(toAccumulateImmediately),
    );
    const queue = this.enqueueReports(toEnqueue);
    const accumulatableReports = toAccumulateImmediately.concat(queue);
    const gasLimit =
      BigInt(G_A) * BigInt(this.chainSpec.coresCount) +
      this.state.privileges.autoAccumulateServices.reduce((acc, { gasLimit }) => acc + gasLimit, 0n);
    const g = tryAsServiceGas(BigInt(G_T) > gasLimit ? BigInt(G_T) : gasLimit);
    const { accumulatedReports, yieldedRoots } = await this.accumulateSequentially(g, accumulatableReports, slot);
    const accumulated = accumulatableReports.slice(0, accumulatedReports);
    const epochLength = this.chainSpec.epochLength;

    for (let i = 0; i < epochLength - 1; i++) {
      this.state.accumulated[i] = this.state.accumulated[i + 1];
    }

    this.state.accumulated[epochLength - 1] = this.getWorkPackageHashes(accumulated);

    const m = slot % epochLength;

    this.state.readyQueue[m] = this.removeDeps(
      toAccumulateLater,
      this.state.accumulated[this.chainSpec.epochLength - 1],
    );

    for (let i = 1; i < epochLength; i++) {
      if (i < slot - this.state.timeslot) {
        this.state.readyQueue[(m + epochLength - i) % epochLength] = [];
      } else {
        const queueIndex = (m + epochLength - i) % epochLength;
        this.state.readyQueue[queueIndex] = this.removeDeps(
          this.state.readyQueue[queueIndex],
          this.state.accumulated[epochLength - 1],
        );
      }
    }

    this.state.timeslot = slot;
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

function uniquePreserveOrder<T extends number>(arr: T[]): T[] {
  const seen = new Set<T>();
  return arr.filter((item) => {
    if (seen.has(item)) {
      return false;
    }
    seen.add(item);
    return true;
  });
}
