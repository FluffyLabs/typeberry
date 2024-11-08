import type { Ed25519Key, WorkReportHash } from "@typeberry/block";
import type { DisputesExtrinsic } from "@typeberry/block/disputes";
import type { ChainSpec } from "@typeberry/config";
import { hashBytes } from "@typeberry/hash";
import { DisputesErrorCode } from "./disputes-error-code";
import { DisputesResult } from "./disputes-result";
import type { DisputesState } from "./disputes-state";
import { isUniqueSortedBy, isUniqueSortedByIndex } from "./sort-utils";
import { verifyCulpritSignature, verifyVoteSignature } from "./verification-utils";

type V = [WorkReportHash, number][];

export class Disputes {
  constructor(
    public state: DisputesState,
    private readonly context: ChainSpec,
  ) {}

  private verifyCulprits(disputes: DisputesExtrinsic) {
    for (const { key, workReportHash, signature } of disputes.culprits) {
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

      // https://graypaper.fluffylabs.dev/#/364735a/124501124501
      if (!verifyCulpritSignature(signature, key, workReportHash)) {
        return DisputesErrorCode.BadSignature;
      }
    }

    // https://graypaper.fluffylabs.dev/#/364735a/12ae0112af01
    if (!isUniqueSortedBy(disputes.culprits, "key")) {
      return DisputesErrorCode.CulpritsNotSortedUnique;
    }

    return null;
  }

  private verifyFaults(disputes: DisputesExtrinsic) {
    for (const { key, workReportHash, signature, wasConsideredValid } of disputes.faults) {
      // https://graypaper.fluffylabs.dev/#/364735a/128b01128b01
      const isInPunishSet = !!this.state.disputesRecords.punishSet.find((item) => item.isEqualTo(key));

      if (isInPunishSet) {
        return DisputesErrorCode.OffenderAlreadyReported;
      }

      // This condition is concluded from jam test vectors. I cannot see any related formula in GP.
      const verdict = disputes.verdicts.find((verdict) => verdict.workReportHash.isEqualTo(workReportHash));
      if (verdict) {
        const hasVote = verdict.votes.find((vote) => vote.signature.isEqualTo(signature));
        if (hasVote) {
          return DisputesErrorCode.FaultVerdictWrong;
        }
      }

      if (!verifyVoteSignature(signature, key, workReportHash, wasConsideredValid)) {
        return DisputesErrorCode.BadSignature;
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
    for (const { votesEpoch, votes, workReportHash } of disputes.verdicts) {
      // https://graypaper.fluffylabs.dev/#/364735a/12a50012a600
      if (votesEpoch !== currentEpoch && votesEpoch + 1 !== currentEpoch) {
        return DisputesErrorCode.BadJudgementAge;
      }

      const k = votesEpoch === currentEpoch ? this.state.currentValidatorData : this.state.previousValidatorData;
      for (const { index, signature, isWorkReportValid } of votes) {
        const key = k[index].ed25519;
        // https://graypaper.fluffylabs.dev/#/364735a/12b70012b700
        if (!verifyVoteSignature(signature, key, workReportHash, isWorkReportValid)) {
          return DisputesErrorCode.BadSignature;
        }
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
    const v: V = [];

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

  private verifyV(v: V, disputes: DisputesExtrinsic) {
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

  updateDisputesRecords(v: V) {
    // https://graypaper.fluffylabs.dev/#/364735a/123403128f03
    for (const [r, sum] of v) {
      if (sum >= this.context.validatorsSuperMajority) {
        this.state.disputesRecords.goodSet.push(r);
      } else if (sum === 0) {
        this.state.disputesRecords.badSet.push(r);
      } else if (sum >= Math.floor(this.context.validatorsCount / 3)) {
        this.state.disputesRecords.wonkySet.push(r);
      }
    }
  }

  clearCoreAssignment(v: V) {
    // https://graypaper.fluffylabs.dev/#/364735a/120403122903
    for (let c = 0; c < this.state.availabilityAssignment.length; c++) {
      const assignment = this.state.availabilityAssignment[c];
      if (assignment) {
        const hash = hashBytes(assignment.workReport);
        const item = v.find(
          ([vHash, noOfVotes]) => hash.isEqualTo(vHash) && noOfVotes < this.context.validatorsSuperMajority,
        );
        if (item) {
          this.state.availabilityAssignment[c] = undefined;
        }
      }
    }
  }

  async transition(disputes: DisputesExtrinsic) {
    const inputError =
      this.verifyVerdicts(disputes) ||
      this.verifyCulprits(disputes) ||
      this.verifyFaults(disputes) ||
      this.verifyIfAlreadyJudged(disputes);

    if (inputError !== null) {
      return DisputesResult.error(inputError);
    }

    const v = this.buildV(disputes);

    const vError = this.verifyV(v, disputes);

    if (vError !== null) {
      return DisputesResult.error(vError);
    }

    this.updateDisputesRecords(v);
    this.clearCoreAssignment(v);

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

    return DisputesResult.ok(offendersMarks);
  }
}
