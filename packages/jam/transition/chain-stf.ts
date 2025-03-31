import { type BlockView, type HeaderHash, tryAsValidatorIndex } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HashDictionary, asKnownSize } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb } from "@typeberry/database";
import { Disputes } from "@typeberry/disputes";
import { HASH_SIZE } from "@typeberry/hash";
import { Safrole } from "@typeberry/safrole";
import type { State } from "@typeberry/state";
import { Assurances, AssurancesError } from "./assurances";
import { Authorization } from "./authorization";
import type { TransitionHasher } from "./hasher";
import { Preimages, PreimagesErrorCode } from "./preimages";
import { RecentHistory } from "./recent-history";
import { Reports, ReportsError } from "./reports";
import type { HeaderChain } from "./reports/verify-contextual";
import { Statistics } from "./statistics";
import {OK, Result} from "@typeberry/utils";
import {DisputesErrorCode} from "@typeberry/disputes/disputes-error-code";
import {SafroleErrorCode} from "@typeberry/safrole/safrole";

class DbHeaderChain implements HeaderChain {
  constructor(private readonly blocks: BlocksDb) {}

  isInChain(header: HeaderHash): boolean {
    return this.blocks.getHeader(header) !== null;
  }
}

export enum ErrorKind {
  Assurances,
  Disputes,
  Safrole,
  Reports,
  Preimages,
};

export type Error = {
  kind: ErrorKind.Assurances;
  error: AssurancesError;
} | {
  kind: ErrorKind.Reports;
  error: ReportsError;
} | {
  kind: ErrorKind.Disputes;
  error: DisputesErrorCode;
} | {
  kind: ErrorKind.Safrole;
  error: SafroleErrorCode;
} | {
  kind: ErrorKind.Preimages;
  error: PreimagesErrorCode;
};

export class OnChain {
  assurances: Assurances;
  authorization: Authorization;
  recentHistory: RecentHistory;
  statistics: Statistics;
  disputes: Disputes;
  safrole: Safrole;
  reports: Reports;
  preimages: Preimages;

  constructor(
    public readonly chainSpec: ChainSpec,
    private readonly state: State,
    blocks: BlocksDb,
    hasher: TransitionHasher,
  ) {
    this.assurances = new Assurances(chainSpec, state);
    this.authorization = new Authorization(chainSpec, state);
    this.preimages = new Preimages(state);
    this.recentHistory = new RecentHistory(hasher, state);
    this.statistics = new Statistics(chainSpec, state);
    this.disputes = new Disputes(chainSpec, state);
    this.safrole = new Safrole(chainSpec, state);
    this.reports = new Reports(chainSpec, state, hasher, new DbHeaderChain(blocks));
  }

  // TODO [ToDr] some mechanism to revert to old state?
  async transition(block: BlockView): Promise<Result<OK, Error>> {
    // TODO [ToDr] Order from GP!
    // TODO [ToDr] Generic validation (checking parent, integrity, etc).

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
      // TODO [ToDr] take from guarantees extrinsic
      used: new Map(),
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

    // TODO [ToDr] Entropy from the current state, but which one?
    const entropy = this.state.entropy[0];
    const safroleResult = await this.safrole.transition({
      slot: timeSlot,
      entropy: header.epochMarker?.entropy ?? entropy,
      extrinsic: block.extrinsic.view().tickets.materialize(),
    });
    if (safroleResult.isError) {
      return Result.error({
        kind: ErrorKind.Safrole,
        error: safroleResult.error,
      });
    }

    // TODO [ToDr] take n from safrole verification?
    const authorIndex = tryAsValidatorIndex(0);
    this.statistics.transition(timeSlot, authorIndex, block.extrinsic.materialize());

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
      // TODO [ToDr] should be current?
      headerHash: header.parentHeaderHash,
      priorStateRoot: header.priorStateRoot,
      accumulateRoot: accumulateRoot,
      // TODO [ToDr] this is already a dictionary inside reports?
      workPackages: HashDictionary.fromEntries(reportsResult.ok.reported.map((x) => [x.workPackageHash, x])),
    });

    return Result.ok(OK);
  }
}
