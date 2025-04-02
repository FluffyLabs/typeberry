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
  // chapter 13: https://graypaper.fluffylabs.dev/#/68eaa1f/18b60118b601?v=0.6.4
  private readonly statistics: Statistics;
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

  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly state: State,
    blocks: BlocksDb,
    public readonly hasher: TransitionHasher,
  ) {
    this.statistics = new Statistics(chainSpec, state);

    this.safrole = new Safrole(chainSpec, state);
    this.safroleSeal = new SafroleSeal();

    this.recentHistory = new RecentHistory(hasher, state);

    this.disputes = new Disputes(chainSpec, state);

    this.reports = new Reports(chainSpec, state, hasher, new DbHeaderChain(blocks));
    this.assurances = new Assurances(chainSpec, state);

    this.preimages = new Preimages(state);

    this.authorization = new Authorization(chainSpec, state);
  }

  async transition(block: BlockView, headerHash: HeaderHash): Promise<Result<OK, Error>> {
    const header = block.header.materialize();
    const timeSlot = header.timeSlotIndex;

    // statistics
    this.statistics.transition(timeSlot, header.bandersnatchBlockAuthorIndex, block.extrinsic.materialize());

    // safrole seal
    const sealState = this.safrole.getSafroleSealState(timeSlot);
    const sealResult = await this.safroleSeal.verifyHeaderSeal(block.header.view(), sealState);
    if (sealResult.isError) {
      return Result.error({
        kind: ErrorKind.SafroleSeal,
        error: sealResult.error,
      });
    }

    // disputes
    const disputesResult = await this.disputes.transition(block.extrinsic.view().disputes.materialize());
    if (disputesResult.isError) {
      return Result.error({
        kind: ErrorKind.Disputes,
        error: disputesResult.error,
      });
    }

    // reports
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

    // safrole
    const safroleResult = await this.safrole.transition({
      slot: timeSlot,
      entropy: sealResult.ok,
      extrinsic: block.extrinsic.view().tickets.materialize(),
    });
    // TODO [ToDr] shall we verify the ticket mark & epoch mark as well?

    if (safroleResult.isError) {
      return Result.error({
        kind: ErrorKind.Safrole,
        error: safroleResult.error,
      });
    }

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

    // TODO [ToDr] output from accumulate
    const accumulateRoot = Bytes.zero(HASH_SIZE).asOpaque();
    // recent history
    this.recentHistory.transition({
      headerHash,
      priorStateRoot: header.priorStateRoot,
      accumulateRoot: accumulateRoot,
      workPackages: reportsResult.ok.reported,
    });
    // authorization
    this.authorization.transition({
      slot: timeSlot,
      used: this.getUsedAuthorizerHashes(block.extrinsic.view().guarantees.view()),
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
