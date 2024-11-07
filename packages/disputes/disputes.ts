import type { Ed25519Key, TimeSlot, WorkReportHash } from "@typeberry/block";
import type { DisputesExtrinsic } from "@typeberry/block/disputes";
import type { Bytes } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import type { ValidatorData } from "@typeberry/safrole";
import { isUniqueSortedBy, isUniqueSortedByIndex } from "./sort-utils";

export class DisputesRecords {
  constructor(
    public goodSet: WorkReportHash[],
    public badSet: WorkReportHash[],
    public wonkySet: WorkReportHash[],
    public punishSet: Ed25519Key[],
  ) {}
}

export class AvailabilityAssignment {
  constructor(
    public workReport: Bytes<353>,
    public timeout: number,
  ) {}
}

export class DisputesState {
  constructor(
    public disputesRecords: DisputesRecords,
    public availabilityAssignment: Array<AvailabilityAssignment | undefined>,
    public timeslot: TimeSlot,
    public currentValidatorData: ValidatorData[],
    public previousValidatorData: ValidatorData[],
  ) {}
}

export enum DisputesErrorCode {
  AlreadyJudged = "already_judged",
  BadVoteSplit = "bad_vote_split",
  VerdictsNotSortedUnique = "verdicts_not_sorted_unique",
  JudgementsNotSortedUnique = "judgements_not_sorted_unique",
  CulpritsNotSortedUnique = "culprits_not_sorted_unique",
  FaultsNotSortedUnique = "faults_not_sorted_unique",
  NotEnoughCulprits = "not_enough_culprits",
  NotEnoughFaults = "not_enough_faults",
  CulpritsVerdictNotBad = "culprits_verdict_not_bad",
  FaultVerdictWrong = "fault_verdict_wrong",
  OffenderAlreadyReported = "offender_already_reported",
  BadJudgementAge = "bad_judgement_age",
  BadValidatorIndex = "bad_validator_index", // TODO
  BadSignature = "bad_signature", // TODO
}

class Result {
  private constructor(
    public offendersMarks: Ed25519Key[] | undefined,
    public err: DisputesErrorCode | undefined,
  ) {}

  static ok(offendersMarks: Ed25519Key[]) {
    return new Result(offendersMarks, undefined);
  }

  static error(error: DisputesErrorCode) {
    return new Result(undefined, error);
  }
}

export class Disputes {
  constructor(
    public state: DisputesState,
    private readonly context: ChainSpec,
  ) {}

  private verifyCulprits(disputes: DisputesExtrinsic) {
    for (const { key, workReportHash } of disputes.culprits) {
      // https://graypaper.fluffylabs.dev/#/364735a/123e01123e01
      const isInPunishSet = !!this.state.disputesRecords.punishSet.find((item) => item.isEqualTo(key));
      if (isInPunishSet) {
        return DisputesErrorCode.OffenderAlreadyReported;
      }

      // https://graypaper.fluffylabs.dev/#/364735a/120a01120b01
      const hasVerdict = disputes.verdicts.find((verdict) => verdict.workReportHash.isEqualTo(workReportHash));
      if (!hasVerdict) {
        return DisputesErrorCode.CulpritsVerdictNotBad;
      }
    }

    // https://graypaper.fluffylabs.dev/#/364735a/12ae0112af01
    if (!isUniqueSortedBy(disputes.culprits, "key")) {
      return DisputesErrorCode.CulpritsNotSortedUnique;
    }

    return null;
  }

  private verifyFaults(disputes: DisputesExtrinsic) {
    for (const { key, workReportHash, signature } of disputes.faults) {
      // https://graypaper.fluffylabs.dev/#/364735a/128b01128b01
      const isInPunishSet = !!this.state.disputesRecords.punishSet.find((item) => item.isEqualTo(key));

      if (isInPunishSet) {
        return DisputesErrorCode.OffenderAlreadyReported;
      }

      const verdict = disputes.verdicts.find((verdict) => verdict.workReportHash.isEqualTo(workReportHash));
      if (verdict) {
        const hasVote = verdict.votes.find((vote) => vote.signature.isEqualTo(signature));
        if (hasVote) {
          return DisputesErrorCode.FaultVerdictWrong;
        }
      }
    }

    // https://graypaper.fluffylabs.dev/#/364735a/12ae0112af01
    if (!isUniqueSortedBy(disputes.faults, "key")) {
      return DisputesErrorCode.FaultsNotSortedUnique;
    }

    return null;
  }

  private verifyVerdicts(disputes: DisputesExtrinsic) {
    const currentEpoch = Math.floor(this.state.timeslot / this.context.epochLength);
    for (const { votesEpoch } of disputes.verdicts) {
      // https://graypaper.fluffylabs.dev/#/364735a/12a50012a600
      if (votesEpoch !== currentEpoch && votesEpoch + 1 !== currentEpoch) {
        return DisputesErrorCode.BadJudgementAge;
      }
    }

    // https://graypaper.fluffylabs.dev/#/364735a/12ad0112ad01
    if (!isUniqueSortedBy(disputes.verdicts, "workReportHash")) {
      return DisputesErrorCode.VerdictsNotSortedUnique;
    }

    // https://graypaper.fluffylabs.dev/#/364735a/122102122202
    if (!disputes.verdicts.every((verdict) => isUniqueSortedByIndex(verdict.votes))) {
      return DisputesErrorCode.JudgementsNotSortedUnique;
    }

    return null;
  }

  private verifyIfAlreadyJudged(disputes: DisputesExtrinsic) {
    for (const verdict of disputes.verdicts) {
      // https://graypaper.fluffylabs.dev/#/364735a/120b02120b02
      const isInGoodSet = this.state.disputesRecords.goodSet.find((record) => record.isEqualTo(verdict.workReportHash));
      const isInBadSet = this.state.disputesRecords.badSet.find((record) => record.isEqualTo(verdict.workReportHash));
      const isInWonkySet = this.state.disputesRecords.wonkySet.find((record) =>
        record.isEqualTo(verdict.workReportHash),
      );
      if (isInGoodSet || isInBadSet || isInWonkySet) {
        return DisputesErrorCode.AlreadyJudged;
      }
    }

    return null;
  }

  private buildV(disputes: DisputesExtrinsic) {
    // https://graypaper.fluffylabs.dev/#/364735a/12760212cd02
    const v: [WorkReportHash, number][] = [];

    for (const verdict of disputes.verdicts) {
      const j = verdict.votes;
      const r = verdict.workReportHash;

      let sum = 0;
      for (const { isWorkReportValid } of j) {
        if (isWorkReportValid) {
          sum += 1;
        }
      }

      v.push([r, sum]);
    }

    return v;
  }

  private verifyV(v: [WorkReportHash, number][], disputes: DisputesExtrinsic) {
    // https://graypaper.fluffylabs.dev/#/364735a/12e50212fa02

    for (const [r, sum] of v) {
      if (sum >= this.context.validatorsSuperMajority) {
        const f = disputes.faults.find((x) => x.workReportHash.isEqualTo(r));
        if (!f) {
          return DisputesErrorCode.NotEnoughFaults;
        }
      } else if (sum === 0) {
        const c1 = disputes.culprits.find((x) => x.workReportHash.isEqualTo(r));
        const c2 = disputes.culprits.findLast((x) => x.workReportHash.isEqualTo(r));
        if (c1 === c2) {
          return DisputesErrorCode.NotEnoughCulprits;
        }
      } else if (sum < Math.floor(this.context.validatorsCount / 3)) {
        return DisputesErrorCode.BadVoteSplit;
      }
    }

    return null;
  }

  async transition(disputes: DisputesExtrinsic) {
    const inputError =
      this.verifyVerdicts(disputes) ||
      this.verifyCulprits(disputes) ||
      this.verifyFaults(disputes) ||
      this.verifyIfAlreadyJudged(disputes);

    if (inputError !== null) {
      return Result.error(inputError);
    }

    const V = this.buildV(disputes);

    const vError = this.verifyV(V, disputes);

    if (vError !== null) {
      return Result.error(vError);
    }

    for (const [r, sum] of V) {
      if (sum >= this.context.validatorsSuperMajority) {
        this.state.disputesRecords.goodSet.push(r);
      } else if (sum === 0) {
        this.state.disputesRecords.badSet.push(r);
      } else if (sum >= Math.floor(this.context.validatorsCount / 3)) {
        this.state.disputesRecords.wonkySet.push(r);
      }
    }

    // GP: https://graypaper.fluffylabs.dev/#/364735a/12b00312cd03
    const offendersMarks: Ed25519Key[] = [];

    for (const { key } of disputes.culprits) {
      offendersMarks.push(key);
      this.state.disputesRecords.punishSet.push(key);
    }

    for (const { key } of disputes.faults) {
      offendersMarks.push(key);
      this.state.disputesRecords.punishSet.push(key);
    }

    return Result.ok(offendersMarks);
  }
}
