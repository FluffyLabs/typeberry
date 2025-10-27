import type { BlockView, CoreIndex, EntropyHash, HeaderHash, ServiceId, TimeSlot } from "@typeberry/block";
import type { GuaranteesExtrinsicView } from "@typeberry/block/guarantees.js";
import type { AuthorizerHash } from "@typeberry/block/refine-context.js";
import { asKnownSize, HashSet } from "@typeberry/collections";
import type { ChainSpec, PvmBackend } from "@typeberry/config";
import type { Ed25519Key } from "@typeberry/crypto";
import type { BlocksDb } from "@typeberry/database";
import { Disputes, type DisputesStateUpdate } from "@typeberry/disputes";
import type { DisputesErrorCode } from "@typeberry/disputes/disputes-error-code.js";
import { Logger } from "@typeberry/logger";
import { Safrole } from "@typeberry/safrole";
import { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm.js";
import type { SafroleErrorCode, SafroleStateUpdate } from "@typeberry/safrole/safrole.js";
import { SafroleSeal, type SafroleSealError } from "@typeberry/safrole/safrole-seal.js";
import type { ServicesUpdate, State, WithStateView } from "@typeberry/state";
import {
  assertEmpty,
  Compatibility,
  check,
  type ErrorResult,
  GpVersion,
  measure,
  OK,
  Result,
  type TaggedError,
} from "@typeberry/utils";
import { AccumulateOutput } from "./accumulate/accumulate-output.js";
import {
  type ACCUMULATION_ERROR,
  Accumulate,
  type AccumulateStateUpdate,
  DeferredTransfers,
  type DeferredTransfersErrorCode,
} from "./accumulate/index.js";
import { Assurances, type AssurancesError, type AssurancesStateUpdate } from "./assurances.js";
import { Authorization, type AuthorizationStateUpdate } from "./authorization.js";
import type { TransitionHasher } from "./hasher.js";
import { Preimages, type PreimagesErrorCode, type PreimagesStateUpdate } from "./preimages.js";
import { RecentHistory, type RecentHistoryStateUpdate } from "./recent-history.js";
import { Reports, type ReportsError, type ReportsStateUpdate } from "./reports/index.js";
import type { HeaderChain } from "./reports/verify-contextual.js";
import { type CountAndGasUsed, Statistics, type StatisticsStateUpdate } from "./statistics.js";

class DbHeaderChain implements HeaderChain {
  constructor(private readonly blocks: BlocksDb) {}

  isAncestor(pastHeaderSlot: TimeSlot, pastHeader: HeaderHash, currentHeader: HeaderHash): boolean {
    let currentHash = currentHeader;
    for (;;) {
      // success = we found the right header in the DB
      if (currentHash.isEqualTo(pastHeader)) {
        return true;
      }

      const current = this.blocks.getHeader(currentHash);
      // fail if we don't find a parent (unlikely?)
      if (current === null) {
        return false;
      }

      // fail if we went pass that time slot index
      if (current.timeSlotIndex.materialize() < pastHeaderSlot) {
        return false;
      }

      // move one block up
      currentHash = current.parentHeaderHash.materialize();
    }
  }
}

const OFFENDERS_ERROR = "offenders not matching header";
type OFFENDERS_ERROR = typeof OFFENDERS_ERROR;

export type Ok = SafroleStateUpdate &
  DisputesStateUpdate &
  ReportsStateUpdate &
  AssurancesStateUpdate &
  PreimagesStateUpdate &
  RecentHistoryStateUpdate &
  AuthorizationStateUpdate &
  AccumulateStateUpdate &
  StatisticsStateUpdate;

export enum StfErrorKind {
  Assurances = 0,
  Disputes = 1,
  Safrole = 2,
  Reports = 3,
  Preimages = 4,
  SafroleSeal = 5,
  Accumulate = 6,
  DeferredTransfers = 7,
  Offenders = 8,
}

export type StfError =
  | TaggedError<StfErrorKind.Assurances, AssurancesError>
  | TaggedError<StfErrorKind.Reports, ReportsError>
  | TaggedError<StfErrorKind.Disputes, DisputesErrorCode>
  | TaggedError<StfErrorKind.Safrole, SafroleErrorCode>
  | TaggedError<StfErrorKind.Preimages, PreimagesErrorCode>
  | TaggedError<StfErrorKind.SafroleSeal, SafroleSealError>
  | TaggedError<StfErrorKind.Accumulate, ACCUMULATION_ERROR>
  | TaggedError<StfErrorKind.DeferredTransfers, DeferredTransfersErrorCode>
  | TaggedError<StfErrorKind.Offenders, OFFENDERS_ERROR>;

export const stfError = <Kind extends StfErrorKind, Err extends StfError["error"]>(
  kind: Kind,
  nested: ErrorResult<Err>,
) => {
  return Result.taggedError<Ok, Kind, Err>(StfErrorKind, kind, nested);
};

const logger = Logger.new(import.meta.filename, "stf");

export class OnChain {
  // chapter 6: https://graypaper.fluffylabs.dev/#/68eaa1f/0d13000d1300?v=0.6.4
  private readonly safrole: Safrole;
  private readonly safroleSeal: SafroleSeal;
  // chapter 10: https://graypaper.fluffylabs.dev/#/68eaa1f/11a30111a301?v=0.6.4
  private readonly disputes: Disputes;
  // chapter 11: https://graypaper.fluffylabs.dev/#/68eaa1f/133100133100?v=0.6.4
  private readonly reports: Reports;
  private readonly assurances: Assurances;
  // chapter 12: https://graypaper.fluffylabs.dev/#/68eaa1f/159f02159f02?v=0.6.4
  private readonly accumulate: Accumulate;
  private readonly accumulateOutput: AccumulateOutput;
  // chapter 12.3: https://graypaper.fluffylabs.dev/#/68eaa1f/178203178203?v=0.6.4
  private readonly deferredTransfers: DeferredTransfers;
  // chapter 12.4: https://graypaper.fluffylabs.dev/#/68eaa1f/18cc0018cc00?v=0.6.4
  private readonly preimages: Preimages;
  // after accumulation
  // chapter 7: https://graypaper.fluffylabs.dev/#/68eaa1f/0faf010faf01?v=0.6.4
  private readonly recentHistory: RecentHistory;
  // chapter 8: https://graypaper.fluffylabs.dev/#/68eaa1f/0f94020f9402?v=0.6.4
  private readonly authorization: Authorization;
  // chapter 13: https://graypaper.fluffylabs.dev/#/68eaa1f/18b60118b601?v=0.6.4
  private readonly statistics: Statistics;

  private isReadyForNextEpoch: Promise<boolean> = Promise.resolve(false);

  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly state: State & WithStateView,
    blocks: BlocksDb,
    public readonly hasher: TransitionHasher,
    pvm: PvmBackend,
  ) {
    const bandersnatch = BandernsatchWasm.new();
    this.statistics = new Statistics(chainSpec, state);

    this.safrole = new Safrole(chainSpec, hasher.blake2b, state, bandersnatch);
    this.safroleSeal = new SafroleSeal(bandersnatch);

    this.recentHistory = new RecentHistory(hasher, state);

    this.disputes = new Disputes(chainSpec, hasher.blake2b, state);

    this.reports = new Reports(chainSpec, hasher.blake2b, state, new DbHeaderChain(blocks));
    this.assurances = new Assurances(chainSpec, state, hasher.blake2b);
    this.accumulate = new Accumulate(chainSpec, hasher.blake2b, state, pvm);
    this.accumulateOutput = new AccumulateOutput();
    this.deferredTransfers = new DeferredTransfers(chainSpec, hasher.blake2b, state, pvm);
    this.preimages = new Preimages(state, hasher.blake2b);

    this.authorization = new Authorization(chainSpec, state);
  }

  /** Pre-populate things worth caching for the next epoch. */
  async prepareForNextEpoch() {
    if (await this.isReadyForNextEpoch) {
      return;
    }
    const ready = this.safrole.prepareValidatorKeysForNextEpoch(this.state.disputesRecords.punishSet);
    this.isReadyForNextEpoch = ready.then((_) => true);
  }

  private async verifySeal(timeSlot: TimeSlot, block: BlockView) {
    const sealState = this.safrole.getSafroleSealState(timeSlot);
    return await this.safroleSeal.verifyHeaderSeal(block.header.view(), sealState);
  }

  async transition(
    block: BlockView,
    headerHash: HeaderHash,
    omitSealVerification = false,
  ): Promise<Result<Ok, StfError>> {
    const headerView = block.header.view();
    const header = block.header.materialize();
    const timeSlot = header.timeSlotIndex;

    // reset the epoch cache state
    if (headerView.epochMarker.view() !== null) {
      this.isReadyForNextEpoch = Promise.resolve(false);
    }

    // safrole seal
    let newEntropyHash: EntropyHash;
    if (omitSealVerification) {
      newEntropyHash = this.hasher.blake2b.hashBytes(header.seal).asOpaque();
    } else {
      const sealResult = await this.verifySeal(timeSlot, block);
      if (sealResult.isError) {
        return stfError(StfErrorKind.SafroleSeal, sealResult);
      }
      newEntropyHash = sealResult.ok;
    }

    // disputes
    const disputesResult = await this.disputes.transition(block.extrinsic.view().disputes.materialize());
    if (disputesResult.isError) {
      return stfError(StfErrorKind.Disputes, disputesResult);
    }
    const {
      stateUpdate: { disputesRecords, availabilityAssignment: disputesAvailAssignment, ...disputesRest },
      offendersMark,
    } = disputesResult.ok;
    assertEmpty(disputesRest);

    const headerOffendersMark = block.header.view().offendersMarker.materialize();
    const offendersResult = checkOffendersMatch(offendersMark, headerOffendersMark);
    if (offendersResult.isError) {
      return stfError(StfErrorKind.Offenders, offendersResult);
    }

    // safrole
    const safroleResult = await this.safrole.transition({
      slot: timeSlot,
      entropy: newEntropyHash,
      extrinsic: block.extrinsic.view().tickets.materialize(),
      punishSet: disputesRecords.punishSet,
      epochMarker: headerView.epochMarker.view(),
      ticketsMarker: headerView.ticketsMarker.view(),
    });
    if (safroleResult.isError) {
      return stfError(StfErrorKind.Safrole, safroleResult);
    }
    const {
      timeslot,
      ticketsAccumulator,
      sealingKeySeries,
      epochRoot,
      entropy,
      nextValidatorData,
      currentValidatorData,
      previousValidatorData,
      ...safroleRest
    } = safroleResult.ok.stateUpdate;
    assertEmpty(safroleRest);

    // partial recent history
    const recentHistoryPartialUpdate = this.recentHistory.partialTransition({
      priorStateRoot: header.priorStateRoot,
    });
    const { recentBlocks: recentBlocksPartialUpdate, ...recentHistoryPartialRest } = recentHistoryPartialUpdate;
    assertEmpty(recentHistoryPartialRest);

    // assurances
    const assurancesResult = await this.assurances.transition({
      assurances: asKnownSize(block.extrinsic.view().assurances.view()),
      slot: timeSlot,
      parentHash: header.parentHeaderHash,
      disputesAvailAssignment,
    });
    if (assurancesResult.isError) {
      return stfError(StfErrorKind.Assurances, assurancesResult);
    }

    const { availableReports, stateUpdate: assurancesUpdate, ...assurancesRest } = assurancesResult.ok;
    assertEmpty(assurancesRest);

    const { availabilityAssignment: assurancesAvailAssignment, ...assurancesUpdateRest } = assurancesUpdate;
    assertEmpty(assurancesUpdateRest);

    // reports
    const reportsResult = await this.reports.transition({
      slot: timeSlot,
      guarantees: block.extrinsic.view().guarantees.view(),
      newEntropy: entropy,
      recentBlocksPartialUpdate,
      assurancesAvailAssignment,
      offenders: offendersMark,
    });
    if (reportsResult.isError) {
      return stfError(StfErrorKind.Reports, reportsResult);
    }
    // NOTE `reporters` are unused
    const { reported: workPackages, reporters: _, stateUpdate: reportsUpdate, ...reportsRest } = reportsResult.ok;
    assertEmpty(reportsRest);
    const { availabilityAssignment: reportsAvailAssignment, ...reportsUpdateRest } = reportsUpdate;
    assertEmpty(reportsUpdateRest);

    // preimages
    const preimagesResult = this.preimages.integrate({
      slot: timeSlot,
      preimages: block.extrinsic.view().preimages.materialize(),
    });
    if (preimagesResult.isError) {
      return stfError(StfErrorKind.Preimages, preimagesResult);
    }
    const { preimages, ...preimagesRest } = preimagesResult.ok;
    assertEmpty(preimagesRest);

    const timerAccumulate = measure("import:accumulate");
    // accumulate
    const accumulateResult = await this.accumulate.transition({
      slot: timeSlot,
      reports: availableReports,
      entropy: entropy[0],
    });
    logger.log`${timerAccumulate()}`;
    if (accumulateResult.isError) {
      return stfError(StfErrorKind.Accumulate, accumulateResult);
    }
    const {
      stateUpdate: accumulateUpdate,
      accumulationStatistics,
      pendingTransfers,
      accumulationOutputLog,
      ...accumulateRest
    } = accumulateResult.ok;
    assertEmpty(accumulateRest);

    const {
      privilegedServices: maybePrivilegedServices,
      authQueues: maybeAuthorizationQueues,
      designatedValidatorData: maybeDesignatedValidatorData,
      preimages: accumulatePreimages,
      accumulationQueue,
      recentlyAccumulated,
      ...servicesUpdateFromAccumulate
    } = accumulateUpdate;

    let transferStatistics = new Map<ServiceId, CountAndGasUsed>();
    let servicesUpdate: ServicesUpdate = { ...servicesUpdateFromAccumulate, preimages: accumulatePreimages };

    if (Compatibility.isLessThan(GpVersion.V0_7_1)) {
      const deferredTransfersResult = await this.deferredTransfers.transition({
        entropy: entropy[0],
        pendingTransfers,
        servicesUpdate,
        timeslot: timeSlot,
      });

      if (deferredTransfersResult.isError) {
        return stfError(StfErrorKind.DeferredTransfers, deferredTransfersResult);
      }

      const {
        servicesUpdate: servicesUpdateFromDeferredTransfers,
        transferStatistics: transferStatisticsFromDeferredTransfers,
        ...deferredTransfersRest
      } = deferredTransfersResult.ok;
      transferStatistics = transferStatisticsFromDeferredTransfers;
      servicesUpdate = servicesUpdateFromDeferredTransfers;
      assertEmpty(deferredTransfersRest);
    } else {
      check`${pendingTransfers.length === 0} All transfers should be already accumulated.`;
    }

    const accumulateRoot = await this.accumulateOutput.transition({ accumulationOutputLog });
    // recent history
    const recentHistoryUpdate = this.recentHistory.transition({
      partial: recentHistoryPartialUpdate,
      headerHash,
      accumulateRoot,
      workPackages,
    });
    const { recentBlocks, ...recentHistoryRest } = recentHistoryUpdate;
    assertEmpty(recentHistoryRest);

    // authorization
    const authorizationUpdate = this.authorization.transition({
      slot: timeSlot,
      used: this.getUsedAuthorizerHashes(block.extrinsic.view().guarantees.view()),
    });
    const { authPools, ...authorizationRest } = authorizationUpdate;
    assertEmpty(authorizationRest);

    const extrinsic = block.extrinsic.materialize();
    const statisticsUpdate = this.statistics.transition({
      slot: timeSlot,
      authorIndex: header.bandersnatchBlockAuthorIndex,
      extrinsic,
      incomingReports: extrinsic.guarantees.map((g) => g.report),
      availableReports,
      accumulationStatistics,
      transferStatistics,
    });
    const { statistics, ...statisticsRest } = statisticsUpdate;
    assertEmpty(statisticsRest);

    // Concat accumulatePreimages updates with preimages
    for (const [serviceId, accPreimageUpdates] of accumulatePreimages.entries()) {
      const preimagesUpdates = preimages.get(serviceId);
      if (preimagesUpdates === undefined) {
        preimages.set(serviceId, accPreimageUpdates);
      } else {
        preimages.set(serviceId, preimagesUpdates.concat(accPreimageUpdates));
      }
    }

    return Result.ok({
      ...(maybeAuthorizationQueues !== undefined ? { authQueues: maybeAuthorizationQueues } : {}),
      ...(maybeDesignatedValidatorData !== undefined ? { designatedValidatorData: maybeDesignatedValidatorData } : {}),
      ...(maybePrivilegedServices !== undefined ? { privilegedServices: maybePrivilegedServices } : {}),
      authPools,
      disputesRecords,
      availabilityAssignment: reportsAvailAssignment,
      recentBlocks,
      statistics,
      timeslot,
      epochRoot,
      entropy,
      currentValidatorData,
      nextValidatorData,
      previousValidatorData,
      sealingKeySeries,
      ticketsAccumulator,
      accumulationQueue,
      recentlyAccumulated,
      accumulationOutputLog,
      ...servicesUpdate,
      preimages,
    });
  }

  private getUsedAuthorizerHashes(guarantees: GuaranteesExtrinsicView) {
    const map = new Map<CoreIndex, HashSet<AuthorizerHash>>();
    for (const guarantee of guarantees) {
      const reportView = guarantee.view().report.view();
      const coreIndex = reportView.coreIndex.materialize();
      const ofCore = map.get(coreIndex) ?? HashSet.new();
      ofCore.insert(reportView.authorizerHash.materialize());
      map.set(coreIndex, ofCore);
    }
    return map;
  }
}

function checkOffendersMatch(
  offendersMark: HashSet<Ed25519Key>,
  headerOffendersMark: Ed25519Key[],
): Result<OK, OFFENDERS_ERROR> {
  if (offendersMark.size !== headerOffendersMark.length) {
    return Result.error(
      OFFENDERS_ERROR,
      () => `Length mismatch: ${offendersMark.size} vs ${headerOffendersMark.length}`,
    );
  }
  for (const key of headerOffendersMark) {
    if (!offendersMark.has(key)) {
      return Result.error(OFFENDERS_ERROR, () => `Missing key: ${key}`);
    }
  }

  return Result.ok(OK);
}
