import type { BlockView, CoreIndex, HeaderHash } from "@typeberry/block";
import type { GuaranteesExtrinsicView } from "@typeberry/block/guarantees";
import type { AuthorizerHash } from "@typeberry/block/work-report";
import { Bytes } from "@typeberry/bytes";
import { HashSet, asKnownSize } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb } from "@typeberry/database";
import { Disputes } from "@typeberry/disputes";
import type { DisputesErrorCode } from "@typeberry/disputes/disputes-error-code";
import { HASH_SIZE } from "@typeberry/hash";
import { Safrole } from "@typeberry/safrole";
import type { SafroleErrorCode } from "@typeberry/safrole/safrole";
import { SafroleSeal, type SafroleSealError } from "@typeberry/safrole/safrole-seal";
import type { State } from "@typeberry/state";
import { OK, Result } from "@typeberry/utils";
import { Assurances, type AssurancesError } from "./assurances";
import { Authorization } from "./authorization";
import type { TransitionHasher } from "./hasher";
import { Preimages, type PreimagesErrorCode } from "./preimages";
import { RecentHistory } from "./recent-history";
import { Reports, type ReportsError } from "./reports";
import type { HeaderChain } from "./reports/verify-contextual";
import { Statistics } from "./statistics";

class DbHeaderChain implements HeaderChain {
  constructor(private readonly blocks: BlocksDb) {}

  isInChain(header: HeaderHash): boolean {
    return this.blocks.getHeader(header) !== null;
  }
}

export enum ErrorKind {
  Assurances = 0,
  Disputes = 1,
  Safrole = 2,
  Reports = 3,
  Preimages = 4,
  SafroleSeal = 5,
}

export type Error =
  | {
      kind: ErrorKind.Assurances;
      error: AssurancesError;
    }
  | {
      kind: ErrorKind.Reports;
      error: ReportsError;
    }
  | {
      kind: ErrorKind.Disputes;
      error: DisputesErrorCode;
    }
  | {
      kind: ErrorKind.Safrole;
      error: SafroleErrorCode;
    }
  | {
      kind: ErrorKind.Preimages;
      error: PreimagesErrorCode;
    }
  | {
      kind: ErrorKind.SafroleSeal;
      error: SafroleSealError;
    };

export class OnChain {
  assurances: Assurances;
  authorization: Authorization;
  recentHistory: RecentHistory;
  statistics: Statistics;
  disputes: Disputes;
  safrole: Safrole;
  safroleSeal: SafroleSeal;
  reports: Reports;
  preimages: Preimages;

  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly state: State,
    blocks: BlocksDb,
    public readonly hasher: TransitionHasher,
  ) {
    this.assurances = new Assurances(chainSpec, state);
    this.authorization = new Authorization(chainSpec, state);
    this.preimages = new Preimages(state);
    this.recentHistory = new RecentHistory(hasher, state);
    this.statistics = new Statistics(chainSpec, state);
    this.disputes = new Disputes(chainSpec, state);
    this.safrole = new Safrole(chainSpec, state);
    this.safroleSeal = new SafroleSeal();
    this.reports = new Reports(chainSpec, state, hasher, new DbHeaderChain(blocks));
  }

  // TODO [ToDr] some mechanism to revert to old state?
  async transition(block: BlockView, headerHash: HeaderHash): Promise<Result<OK, Error>> {
    // TODO [ToDr] Order from GP!

    const header = block.header.materialize();
    const timeSlot = header.timeSlotIndex;
    // assurances
    const assurancesResult = await this.assurances.transition({
      assurances: asKnownSize(block.extrinsic.view().assurances.view()),
      slot: timeSlot,
      parentHash: header.parentHeaderHash,
    });
    if (assurancesResult.isError) {
      return Result.error({
        kind: ErrorKind.Assurances,
        error: assurancesResult.error,
      });
    }

    // authorization
    this.authorization.transition({
      slot: timeSlot,
      used: this.getUsedAuthorizerHashes(block.extrinsic.view().guarantees.view()),
    });

    // preimages
    const preimagesResult = this.preimages.integrate({
      slot: timeSlot,
      preimages: block.extrinsic.view().preimages.materialize(),
    });
    if (preimagesResult.isError) {
      return Result.error({
        kind: ErrorKind.Preimages,
        error: preimagesResult.error,
      });
    }

    this.statistics.transition(timeSlot, header.bandersnatchBlockAuthorIndex, block.extrinsic.materialize());

    const sealState = this.safrole.getSafroleSealState(timeSlot);
    const sealResult = await this.safroleSeal.verifyHeaderSeal(block.header.view(), sealState);
    if (sealResult.isError) {
      return Result.error({
        kind: ErrorKind.SafroleSeal,
        error: sealResult.error,
      });
    }

    const safroleResult = await this.safrole.transition({
      slot: timeSlot,
      entropy: sealResult.ok,
      extrinsic: block.extrinsic.view().tickets.materialize(),
    });

    if (safroleResult.isError) {
      return Result.error({
        kind: ErrorKind.Safrole,
        error: safroleResult.error,
      });
    }

    const disputesResult = await this.disputes.transition(block.extrinsic.view().disputes.materialize());
    if (disputesResult.isError) {
      return Result.error({
        kind: ErrorKind.Disputes,
        error: disputesResult.error,
      });
    }

    const reportsResult = await this.reports.transition({
      slot: timeSlot,
      guarantees: block.extrinsic.view().guarantees.view(),
    });
    if (reportsResult.isError) {
      return Result.error({
        kind: ErrorKind.Reports,
        error: reportsResult.error,
      });
    }

    // TODO [ToDr] output from accumulate
    const accumulateRoot = Bytes.zero(HASH_SIZE).asOpaque();
    // recent history
    this.recentHistory.transition({
      headerHash,
      priorStateRoot: header.priorStateRoot,
      accumulateRoot: accumulateRoot,
      workPackages: reportsResult.ok.reported,
    });

    return Result.ok(OK);
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
