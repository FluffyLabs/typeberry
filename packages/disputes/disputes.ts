import type { Ed25519Key, WorkReportHash } from "@typeberry/block";
import type { DisputesExtrinsic } from "@typeberry/block/disputes";
import { SortedSet } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { hashBytes } from "@typeberry/hash";
import { DisputesErrorCode } from "./disputes-error-code";
import { DisputesResult } from "./disputes-result";
import { type DisputesState, hashComparator } from "./disputes-state";
import { isUniqueSortedBy, isUniqueSortedByIndex } from "./sort-utils";
import { verifyCulpritSignature, verifyVoteSignature } from "./verification-utils";

type V = [WorkReportHash, number][];

type NewDisputesRecordsItems = {
  toAddToGoodSet: SortedSet<WorkReportHash>;
  toAddToBadSet: SortedSet<WorkReportHash>;
  toAddToWonkySet: SortedSet<WorkReportHash>;
};

export class Disputes {
  constructor(
    public state: DisputesState,
    private readonly context: ChainSpec,
  ) {}

  private verifyCulprits(disputes: DisputesExtrinsic, newItems: NewDisputesRecordsItems) {
    for (const { key, workReportHash, signature } of disputes.culprits) {
      // check if some offenders weren't reported earlier
      // https://graypaper.fluffylabs.dev/#/364735a/123e01123e01
      const isInPunishSet = !!this.state.disputesRecords.punishSet.findExact(key);
      if (isInPunishSet) {
        return DisputesErrorCode.OffenderAlreadyReported;
      }

      // verify if the culprit will be in new bad set
      // https://graypaper.fluffylabs.dev/#/364735a/122f01122f01
      const isInNewBadSet = newItems.toAddToBadSet.findExact(workReportHash);
      if (!isInNewBadSet) {
        return DisputesErrorCode.CulpritsVerdictNotBad;
      }

      // verify culprit signature
      // https://graypaper.fluffylabs.dev/#/364735a/124501124501
      if (!verifyCulpritSignature(signature, key, workReportHash)) {
        return DisputesErrorCode.BadSignature;
      }
    }

    // check if culprits are sorted by key
    // https://graypaper.fluffylabs.dev/#/364735a/12ae0112af01
    if (!isUniqueSortedBy(disputes.culprits, "key")) {
      return DisputesErrorCode.CulpritsNotSortedUnique;
    }

    return null;
  }

  private verifyFaults(disputes: DisputesExtrinsic, newItems: NewDisputesRecordsItems) {
    for (const { key, workReportHash, signature, wasConsideredValid } of disputes.faults) {
      // check if some offenders weren't reported earlier
      // https://graypaper.fluffylabs.dev/#/364735a/128b01128b01
      const isInPunishSet = !!this.state.disputesRecords.punishSet.findExact(key);

      if (isInPunishSet) {
        return DisputesErrorCode.OffenderAlreadyReported;
      }

      // verify if the fault will be included in new good/bad set
      // it may be not correct as in GP there is "iff" what means it should be rather
      // if (!wasConsideredValid || isInNewGoodSet || !isInNewBadSet) return DisputesErrorCode.FaultVerdictWrong;
      // but it does not pass the tests
      // https://graypaper.fluffylabs.dev/#/364735a/127301127f01
      if (wasConsideredValid) {
        const isInNewGoodSet = newItems.toAddToGoodSet.findExact(workReportHash);
        const isInNewBadSet = newItems.toAddToBadSet.findExact(workReportHash);

        if (isInNewGoodSet || !isInNewBadSet) {
          return DisputesErrorCode.FaultVerdictWrong;
        }
      }

      // verify fault signature
      // https://graypaper.fluffylabs.dev/#/364735a/129201129201
      if (!verifyVoteSignature(signature, key, workReportHash, wasConsideredValid)) {
        return DisputesErrorCode.BadSignature;
      }
    }

    // check if faults are sorted by key
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
        const key = k[index]?.ed25519;

        // no particular GP fragment but I think we don't belive in ghosts
        if (!key) {
          return DisputesErrorCode.BadValidatorIndex;
        }

        // verify vote signature. Here we have a performance bottleneck
        // https://graypaper.fluffylabs.dev/#/364735a/12b70012b700
        if (!verifyVoteSignature(signature, key, workReportHash, isWorkReportValid)) {
          return DisputesErrorCode.BadSignature;
        }
      }
    }

    // check if verdicts are correctly sorted
    // https://graypaper.fluffylabs.dev/#/364735a/12ad0112ad01
    if (!isUniqueSortedBy(disputes.verdicts, "workReportHash")) {
      return DisputesErrorCode.VerdictsNotSortedUnique;
    }

    // check if judgement are correctly sorted
    // https://graypaper.fluffylabs.dev/#/364735a/122102122202
    if (!disputes.verdicts.every((verdict) => isUniqueSortedByIndex(verdict.votes))) {
      return DisputesErrorCode.JudgementsNotSortedUnique;
    }

    return null;
  }

  private verifyIfAlreadyJudged(disputes: DisputesExtrinsic) {
    for (const verdict of disputes.verdicts) {
      // current verdicts should not be reported earlier
      // https://graypaper.fluffylabs.dev/#/364735a/120b02120b02
      const isInGoodSet = this.state.disputesRecords.goodSet.findExact(verdict.workReportHash);
      const isInBadSet = this.state.disputesRecords.badSet.findExact(verdict.workReportHash);
      const isInWonkySet = this.state.disputesRecords.wonkySet.findExact(verdict.workReportHash);

      if (isInGoodSet || isInBadSet || isInWonkySet) {
        return DisputesErrorCode.AlreadyJudged;
      }
    }

    return null;
  }

  private buildV(disputes: DisputesExtrinsic) {
    // calculate total votes for each work report
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
    // verify if the vote split is correct and if number of faults/culprints is correct
    // https://graypaper.fluffylabs.dev/#/364735a/12e50212fa02

    for (const [r, sum] of v) {
      if (sum === this.context.validatorsSuperMajority) {
        // there has to be at least 1 fault with the same work report hash
        // https://graypaper.fluffylabs.dev/#/364735a/12db0212e602
        const f = disputes.faults.find((x) => x.workReportHash.isEqualTo(r));
        if (!f) {
          return DisputesErrorCode.NotEnoughFaults;
        }
      } else if (sum === 0) {
        // there has to be at least 2 culprits with the same work report hash
        // https://graypaper.fluffylabs.dev/#/364735a/12f60212fa02
        const c1 = disputes.culprits.find((x) => x.workReportHash.isEqualTo(r));
        const c2 = disputes.culprits.findLast((x) => x.workReportHash.isEqualTo(r));
        if (c1 === c2) {
          return DisputesErrorCode.NotEnoughCulprits;
        }
      } else if (sum !== Math.floor(this.context.validatorsCount / 3)) {
        // positive votes count is not correct
        // https://graypaper.fluffylabs.dev/#/364735a/123a02126b02
        return DisputesErrorCode.BadVoteSplit;
      }
    }

    return null;
  }

  private getDisputesRecordsNewItems(v: V) {
    const toAddToGoodSet: SortedSet<WorkReportHash> = SortedSet.fromArray(hashComparator);
    const toAddToBadSet: SortedSet<WorkReportHash> = SortedSet.fromArray(hashComparator);
    const toAddToWonkySet: SortedSet<WorkReportHash> = SortedSet.fromArray(hashComparator);

    // prepare new disputes records items but do not update the state yet
    // the state will be updated after verification
    // https://graypaper.fluffylabs.dev/#/364735a/123403128f03
    for (const [r, sum] of v) {
      if (sum >= this.context.validatorsSuperMajority) {
        toAddToGoodSet.insert(r);
      } else if (sum === 0) {
        toAddToBadSet.insert(r);
      } else if (sum >= Math.floor(this.context.validatorsCount / 3)) {
        toAddToWonkySet.insert(r);
      }
    }

    return { toAddToGoodSet, toAddToBadSet, toAddToWonkySet };
  }

  private clearCoreAssignment(v: V) {
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

  private getOffenders(disputes: DisputesExtrinsic) {
    // https://graypaper.fluffylabs.dev/#/364735a/12a50312a503
    const offendersMarks: Ed25519Key[] = [];

    for (const { key } of disputes.culprits) {
      offendersMarks.push(key);
    }

    for (const { key } of disputes.faults) {
      offendersMarks.push(key);
    }

    return offendersMarks;
  }

  private updateDisputesRecords(newItems: NewDisputesRecordsItems, offenders: Ed25519Key[]) {
    // https://graypaper.fluffylabs.dev/#/364735a/12530312a603
    for (const newGoodSetItem of newItems.toAddToGoodSet.slice()) {
      this.state.disputesRecords.goodSet.insert(newGoodSetItem);
    }

    for (const newBadSetItem of newItems.toAddToBadSet.slice()) {
      this.state.disputesRecords.badSet.insert(newBadSetItem);
    }

    for (const newWonkySetItem of newItems.toAddToWonkySet.slice()) {
      this.state.disputesRecords.wonkySet.insert(newWonkySetItem);
    }

    for (const offender of offenders) {
      this.state.disputesRecords.punishSet.insert(offender);
    }
  }

  async transition(disputes: DisputesExtrinsic) {
    const v = this.buildV(disputes);
    const newItems = this.getDisputesRecordsNewItems(v);

    const inputError =
      this.verifyVerdicts(disputes) ||
      this.verifyV(v, disputes) ||
      this.verifyCulprits(disputes, newItems) ||
      this.verifyFaults(disputes, newItems) ||
      this.verifyIfAlreadyJudged(disputes);

    if (inputError !== null) {
      return DisputesResult.error(inputError);
    }

    // GP: https://graypaper.fluffylabs.dev/#/364735a/12b00312cd03
    const offendersMarks = this.getOffenders(disputes);
    this.updateDisputesRecords(newItems, offendersMarks);
    this.clearCoreAssignment(v);
    return DisputesResult.ok(offendersMarks);
  }
}
