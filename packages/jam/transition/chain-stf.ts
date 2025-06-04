import type { BlockView, CoreIndex, EntropyHash, HeaderHash, TimeSlot } from "@typeberry/block";
import type { GuaranteesExtrinsicView } from "@typeberry/block/guarantees";
import type { AuthorizerHash } from "@typeberry/block/work-report";
import { Bytes } from "@typeberry/bytes";
import { HashSet, asKnownSize } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb } from "@typeberry/database";
import { Disputes } from "@typeberry/disputes";
import type { DisputesStateUpdate } from "@typeberry/disputes";
import type { DisputesErrorCode } from "@typeberry/disputes/disputes-error-code";
import { HASH_SIZE } from "@typeberry/hash";
import { Safrole } from "@typeberry/safrole";
import type { SafroleErrorCode, SafroleStateUpdate } from "@typeberry/safrole";
import { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm";
import { SafroleSeal, type SafroleSealError } from "@typeberry/safrole/safrole-seal";
import type { State } from "@typeberry/state";
import { type ErrorResult, Result, type TaggedError } from "@typeberry/utils";
import { Assurances, type AssurancesError, type AssurancesStateUpdate } from "./assurances";
import { Authorization, type AuthorizationStateUpdate } from "./authorization";
import type { TransitionHasher } from "./hasher";
import { Preimages, type PreimagesErrorCode, type PreimagesStateUpdate } from "./preimages";
import { RecentHistory, type RecentHistoryStateUpdate } from "./recent-history";
import { Reports, type ReportsError, type ReportsStateUpdate } from "./reports";
import type { HeaderChain } from "./reports/verify-contextual";
import { Statistics, type StatisticsStateUpdate } from "./statistics";

class DbHeaderChain implements HeaderChain {
  constructor(private readonly blocks: BlocksDb) {}

  isInChain(header: HeaderHash): boolean {
    return this.blocks.getHeader(header) !== null;
  }
}

export enum StfErrorKind {
  Assurances = 0,
  Disputes = 1,
  Safrole = 2,
  Reports = 3,
  Preimages = 4,
  SafroleSeal = 5,
}

export type Ok = SafroleStateUpdate &
  DisputesStateUpdate &
  ReportsStateUpdate &
  AssurancesStateUpdate &
  PreimagesStateUpdate &
  RecentHistoryStateUpdate &
  AuthorizationStateUpdate &
  StatisticsStateUpdate;

export type StfError =
  | TaggedError<StfErrorKind.Assurances, AssurancesError>
  | TaggedError<StfErrorKind.Reports, ReportsError>
  | TaggedError<StfErrorKind.Disputes, DisputesErrorCode>
  | TaggedError<StfErrorKind.Safrole, SafroleErrorCode>
  | TaggedError<StfErrorKind.Preimages, PreimagesErrorCode>
  | TaggedError<StfErrorKind.SafroleSeal, SafroleSealError>;

export const stfError = <Kind extends StfErrorKind, Err extends StfError["error"]>(
  kind: Kind,
  nested: ErrorResult<Err>,
) => {
  return Result.taggedError<Ok, Kind, Err>(StfErrorKind, kind, nested);
};

export class OnChain {
  // chapter 6: https://graypaper.fluffylabs.dev/#/68eaa1f/0d13000d1300?v=0.6.4
  private readonly safrole: Safrole;
  private readonly safroleSeal: SafroleSeal;
  // chapter 10: https://graypaper.fluffylabs.dev/#/68eaa1f/11a30111a301?v=0.6.4
  private readonly disputes: Disputes;
  // chapter 11: https://graypaper.fluffylabs.dev/#/68eaa1f/133100133100?v=0.6.4
  private readonly reports: Reports;
  private readonly assurances: Assurances;
  // chapter 12.4: https://graypaper.fluffylabs.dev/#/68eaa1f/18cc0018cc00?v=0.6.4
  private readonly preimages: Preimages;
  // after accumulation
  // chapter 7: https://graypaper.fluffylabs.dev/#/68eaa1f/0faf010faf01?v=0.6.4
  private readonly recentHistory: RecentHistory;
  // chapter 8: https://graypaper.fluffylabs.dev/#/68eaa1f/0f94020f9402?v=0.6.4
  private readonly authorization: Authorization;
  // chapter 13: https://graypaper.fluffylabs.dev/#/68eaa1f/18b60118b601?v=0.6.4
  private readonly statistics: Statistics;

  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly state: State,
    blocks: BlocksDb,
    public readonly hasher: TransitionHasher,
    { enableParallelSealVerification }: { enableParallelSealVerification: boolean },
  ) {
    const bandersnatch = BandernsatchWasm.new({ synchronous: !enableParallelSealVerification });
    this.statistics = new Statistics(chainSpec, state);

    this.safrole = new Safrole(chainSpec, state, bandersnatch);
    this.safroleSeal = new SafroleSeal(bandersnatch);

    this.recentHistory = new RecentHistory(hasher, state);

    this.disputes = new Disputes(chainSpec, state);

    this.reports = new Reports(chainSpec, state, hasher, new DbHeaderChain(blocks));
    this.assurances = new Assurances(chainSpec, state);

    this.preimages = new Preimages(state);

    this.authorization = new Authorization(chainSpec, state);
  }

  async verifySeal(timeSlot: TimeSlot, block: BlockView) {
    const sealState = this.safrole.getSafroleSealState(timeSlot);
    return await this.safroleSeal.verifyHeaderSeal(block.header.view(), sealState);
  }

  async transition(
    block: BlockView,
    headerHash: HeaderHash,
    preverifiedSeal: EntropyHash | null = null,
  ): Promise<Result<Ok, StfError>> {
    const header = block.header.materialize();
    const timeSlot = header.timeSlotIndex;

    // safrole seal
    let newEntropyHash = preverifiedSeal;
    if (newEntropyHash === null) {
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
      disputesRecords,
      availabilityAssignment: disputesAvailAssignment,
      ...disputesRest
    } = disputesResult.ok.stateUpdate;
    assertEmpty(disputesRest);

    // reports
    const reportsResult = await this.reports.transition({
      slot: timeSlot,
      guarantees: block.extrinsic.view().guarantees.view(),
      knownPackages: [],
    });
    if (reportsResult.isError) {
      return stfError(StfErrorKind.Reports, reportsResult);
    }
    const { availabilityAssignment: reportsAvailAssignment, ...reportsRest } = reportsResult.ok.stateUpdate;
    assertEmpty(reportsRest);

    // assurances
    const assurancesResult = await this.assurances.transition({
      assurances: asKnownSize(block.extrinsic.view().assurances.view()),
      slot: timeSlot,
      parentHash: header.parentHeaderHash,
    });
    if (assurancesResult.isError) {
      return stfError(StfErrorKind.Assurances, assurancesResult);
    }
    const { availabilityAssignment: assurancesAvailAssignment, ...assurancesRest } = assurancesResult.ok.stateUpdate;
    assertEmpty(assurancesRest);

    // safrole
    const safroleResult = await this.safrole.transition({
      slot: timeSlot,
      entropy: newEntropyHash,
      extrinsic: block.extrinsic.view().tickets.materialize(),
    });
    // TODO [ToDr] shall we verify the ticket mark & epoch mark as well?
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

    // TODO [ToDr] output from accumulate
    const accumulateRoot = Bytes.zero(HASH_SIZE).asOpaque();
    // recent history
    const recentHistoryUpdate = this.recentHistory.transition({
      headerHash,
      priorStateRoot: header.priorStateRoot,
      accumulateRoot: accumulateRoot,
      workPackages: reportsResult.ok.reported,
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

    // TODO [MaSo] fill in the statistics with accumulation results
    // statistics
    const statisticsUpdate = this.statistics.transition({
      slot: timeSlot,
      authorIndex: header.bandersnatchBlockAuthorIndex,
      extrinsic,
      incomingReports: extrinsic.guarantees.map((g) => g.report),
      availableReports: assurancesResult.ok.availableReports,
      accumulationStatistics: new Map(),
      transferStatistics: new Map(),
    });
    const { statistics, ...statisticsRest } = statisticsUpdate;
    assertEmpty(statisticsRest);

    return Result.ok({
      authPools,
      preimages,
      disputesRecords,
      availabilityAssignment: mergeAvailabilityAssignments(
        reportsAvailAssignment,
        disputesAvailAssignment,
        assurancesAvailAssignment,
      ),
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

function assertEmpty<T extends Record<string, never>>(_x: T) {}

type AvailAssignment = State["availabilityAssignment"];

/**
 * Since multiple modules might alter the availalbility assignment,
 * we need to merge the results.
 *
 * NOTE: both `Disputes` and `Assurances` will clear out the availability assignment.
 *       reports however will assign new reports to cores.
 */
function mergeAvailabilityAssignments(
  reportsAvailAssignment: AvailAssignment,
  disputesAvailAssignment: AvailAssignment,
  assurancesAvailAssignment: AvailAssignment,
) {
  const newAssignments = reportsAvailAssignment.slice();

  for (const core of reportsAvailAssignment.keys()) {
    if (disputesAvailAssignment[core] === null || assurancesAvailAssignment[core] === null) {
      newAssignments[core] = null;
    }
  }

  // This is safe, since we are cloning the whole array.
  return asKnownSize(newAssignments);
}
