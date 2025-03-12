import type { Ed25519Key, WorkReportHash } from "@typeberry/block";
import type { DisputesExtrinsic } from "@typeberry/block/disputes";
import { HashDictionary, SortedArray, SortedSet } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { hashComparator } from "@typeberry/state";
import { Result } from "@typeberry/utils";
import { DisputesErrorCode } from "./disputes-error-code";
import type { DisputesState } from "./disputes-state";
import { isUniqueSortedBy, isUniqueSortedByIndex } from "./sort-utils";
import {
  type VerificationInput,
  type VerificationOutput,
  prepareCulpritSignature,
  prepareFaultSignature,
  prepareJudgementSignature,
  vefifyAllSignatures,
} from "./verification-utils";

type VotesForWorkReports = HashDictionary<WorkReportHash, number>;

type NewDisputesRecordsItems = {
  toAddToGoodSet: SortedSet<WorkReportHash>;
  toAddToBadSet: SortedSet<WorkReportHash>;
  toAddToWonkySet: SortedSet<WorkReportHash>;
};

type Ok = null;
export class Disputes {
  constructor(
    public readonly state: DisputesState,
    private readonly context: ChainSpec,
  ) {}

  private verifyCulprits(
    disputes: DisputesExtrinsic,
    newItems: NewDisputesRecordsItems,
    verificationResult: VerificationOutput,
  ): Result<Ok, DisputesErrorCode> {
    // check if culprits are sorted by key
    // https://graypaper.fluffylabs.dev/#/579bd12/12c50112c601
    if (!isUniqueSortedBy(disputes.culprits, "key")) {
      return Result.error(DisputesErrorCode.CulpritsNotSortedUnique);
    }

    const culprintsLength = disputes.culprits.length;
    for (let i = 0; i < culprintsLength; i++) {
      const { key, workReportHash } = disputes.culprits[i];
      // check if some offenders weren't reported earlier
      // https://graypaper.fluffylabs.dev/#/579bd12/125501125501
      const isInPunishSet = this.state.disputesRecords.punishSet.findExact(key) != null;
      if (isInPunishSet) {
        return Result.error(DisputesErrorCode.OffenderAlreadyReported);
      }

      // verify if the culprit will be in new bad set
      // https://graypaper.fluffylabs.dev/#/579bd12/124601124601
      const isInNewBadSet = newItems.toAddToBadSet.findExact(workReportHash);
      if (isInNewBadSet == null) {
        return Result.error(DisputesErrorCode.CulpritsVerdictNotBad);
      }

      // verify culprit signature
      // https://graypaper.fluffylabs.dev/#/579bd12/125c01125c01
      const result = verificationResult.culprits[i];
      if (!result?.isValid) {
        return Result.error(DisputesErrorCode.BadSignature);
      }
    }

    return Result.ok(null);
  }

  private verifyFaults(
    disputes: DisputesExtrinsic,
    newItems: NewDisputesRecordsItems,
    verificationResult: VerificationOutput,
  ): Result<Ok, DisputesErrorCode> {
    // check if faults are sorted by key
    // https://graypaper.fluffylabs.dev/#/579bd12/12c50112c601
    if (!isUniqueSortedBy(disputes.faults, "key")) {
      return Result.error(DisputesErrorCode.FaultsNotSortedUnique);
    }

    const faultsLength = disputes.faults.length;
    for (let i = 0; i < faultsLength; i++) {
      const { key, workReportHash, wasConsideredValid } = disputes.faults[i];
      // check if some offenders weren't reported earlier
      // https://graypaper.fluffylabs.dev/#/579bd12/12a20112a201
      const isInPunishSet = this.state.disputesRecords.punishSet.findExact(key) != null;

      if (isInPunishSet) {
        return Result.error(DisputesErrorCode.OffenderAlreadyReported);
      }

      // verify if the fault will be included in new good/bad set
      // it may be not correct as in GP there is "iff" what means it should be rather
      // if (!wasConsideredValid || isInNewGoodSet || !isInNewBadSet) return DisputesErrorCode.FaultVerdictWrong;
      // but it does not pass the tests
      // https://graypaper.fluffylabs.dev/#/579bd12/128a01129601
      if (wasConsideredValid) {
        const isInNewGoodSet = newItems.toAddToGoodSet.findExact(workReportHash);
        const isInNewBadSet = newItems.toAddToBadSet.findExact(workReportHash);

        if (isInNewGoodSet != null || isInNewBadSet == null) {
          return Result.error(DisputesErrorCode.FaultVerdictWrong);
        }
      }

      // verify fault signature. Verification was done earlier, here we only check the result.
      // https://graypaper.fluffylabs.dev/#/579bd12/12a90112a901
      const result = verificationResult.faults[i];
      if (!result.isValid) {
        return Result.error(DisputesErrorCode.BadSignature);
      }
    }

    return Result.ok(null);
  }

  private verifyVerdicts(
    disputes: DisputesExtrinsic,
    verificationResult: VerificationOutput,
  ): Result<Ok, DisputesErrorCode> {
    // check if verdicts are correctly sorted
    // https://graypaper.fluffylabs.dev/#/579bd12/12c40112c401
    if (!isUniqueSortedBy(disputes.verdicts, "workReportHash")) {
      return Result.error(DisputesErrorCode.VerdictsNotSortedUnique);
    }

    // check if judgement are correctly sorted
    // https://graypaper.fluffylabs.dev/#/579bd12/123702123802
    if (disputes.verdicts.some((verdict) => !isUniqueSortedByIndex(verdict.votes))) {
      return Result.error(DisputesErrorCode.JudgementsNotSortedUnique);
    }

    const currentEpoch = Math.floor(this.state.timeslot / this.context.epochLength);
    let voteSignatureIndex = 0;
    for (const { votesEpoch, votes } of disputes.verdicts) {
      // https://graypaper.fluffylabs.dev/#/579bd12/12bb0012bc00
      if (votesEpoch !== currentEpoch && votesEpoch + 1 !== currentEpoch) {
        return Result.error(DisputesErrorCode.BadJudgementAge);
      }

      const k = votesEpoch === currentEpoch ? this.state.currentValidatorData : this.state.previousValidatorData;
      for (const { index } of votes) {
        const key = k[index]?.ed25519;

        // no particular GP fragment but I think we don't believe in ghosts
        if (key == null) {
          return Result.error(DisputesErrorCode.BadValidatorIndex);
        }

        // verify vote signature. Verification was done earlier, here we only check the result.
        // https://graypaper.fluffylabs.dev/#/579bd12/12cd0012cd00
        const result = verificationResult.judgements[voteSignatureIndex];
        if (!result.isValid) {
          return Result.error(DisputesErrorCode.BadSignature);
        }
        voteSignatureIndex += 1;
      }
    }

    return Result.ok(null);
  }

  private verifyIfAlreadyJudged(disputes: DisputesExtrinsic): Result<Ok, DisputesErrorCode> {
    for (const verdict of disputes.verdicts) {
      // current verdicts should not be reported earlier
      // https://graypaper.fluffylabs.dev/#/579bd12/122202122202
      const isInGoodSet = this.state.disputesRecords.goodSet.findExact(verdict.workReportHash);
      const isInBadSet = this.state.disputesRecords.badSet.findExact(verdict.workReportHash);
      const isInWonkySet = this.state.disputesRecords.wonkySet.findExact(verdict.workReportHash);

      if (isInGoodSet != null || isInBadSet != null || isInWonkySet != null) {
        return Result.error(DisputesErrorCode.AlreadyJudged);
      }
    }

    return Result.ok(null);
  }

  private calculateVotesForWorkReports(disputes: DisputesExtrinsic) {
    // calculate total votes for each work report
    // https://graypaper.fluffylabs.dev/#/579bd12/128c0212e302
    const v = new HashDictionary<WorkReportHash, number>();

    for (const verdict of disputes.verdicts) {
      const j = verdict.votes;
      const r = verdict.workReportHash;

      let sum = 0;
      for (const { isWorkReportValid } of j) {
        if (isWorkReportValid) {
          sum += 1;
        }
      }

      v.set(r, sum);
    }

    return v;
  }

  private verifyVotesForWorkReports(
    v: VotesForWorkReports,
    disputes: DisputesExtrinsic,
  ): Result<Ok, DisputesErrorCode> {
    // verify if the vote split is correct and if number of faults/culprits is correct
    // https://graypaper.fluffylabs.dev/#/579bd12/12fb02121003

    for (const [r, sum] of v) {
      if (sum === this.context.validatorsSuperMajority) {
        // there has to be at least 1 fault with the same work report hash
        // https://graypaper.fluffylabs.dev/#/579bd12/12f10212fc02
        const f = disputes.faults.find((x) => x.workReportHash.isEqualTo(r));
        if (f == null) {
          return Result.error(DisputesErrorCode.NotEnoughFaults);
        }
      } else if (sum === 0) {
        // there has to be at least 2 culprits with the same work report hash
        // https://graypaper.fluffylabs.dev/#/579bd12/120c03121003
        const c1 = disputes.culprits.find((x) => x.workReportHash.isEqualTo(r));
        const c2 = disputes.culprits.findLast((x) => x.workReportHash.isEqualTo(r));
        if (c1 === c2) {
          return Result.error(DisputesErrorCode.NotEnoughCulprits);
        }
      } else if (sum !== this.context.thirdOfValidators) {
        // positive votes count is not correct
        // https://graypaper.fluffylabs.dev/#/579bd12/125002128102
        return Result.error(DisputesErrorCode.BadVoteSplit);
      }
    }

    return Result.ok(null);
  }

  private getDisputesRecordsNewItems(v: VotesForWorkReports) {
    const toAddToGoodSet: WorkReportHash[] = [];
    const toAddToBadSet: WorkReportHash[] = [];
    const toAddToWonkySet: WorkReportHash[] = [];

    // prepare new disputes records items but do not update the state yet
    // the state will be updated after verification
    // https://graypaper.fluffylabs.dev/#/579bd12/124a0312a503
    for (const [r, sum] of v) {
      if (sum >= this.context.validatorsSuperMajority) {
        toAddToGoodSet.push(r);
      } else if (sum === 0) {
        toAddToBadSet.push(r);
      } else if (sum >= this.context.thirdOfValidators) {
        toAddToWonkySet.push(r);
      }
    }

    return {
      toAddToGoodSet: SortedSet.fromArray(hashComparator, toAddToGoodSet),
      toAddToBadSet: SortedSet.fromArray(hashComparator, toAddToBadSet),
      toAddToWonkySet: SortedSet.fromArray(hashComparator, toAddToWonkySet),
    };
  }

  private clearCoreAssignment(v: VotesForWorkReports) {
    /**
     * We clear any work-reports which we judged as uncertain or invalid from their core.
     * https://graypaper.fluffylabs.dev/#/579bd12/121a03123f03
     */
    for (let c = 0; c < this.state.availabilityAssignment.length; c++) {
      const assignment = this.state.availabilityAssignment[c];
      if (assignment != null) {
        const sum = v.get(assignment.workReport.hash);
        if (sum !== undefined && sum < this.context.validatorsSuperMajority) {
          this.state.availabilityAssignment[c] = null;
        }
      }
    }
  }

  private getOffenders(disputes: DisputesExtrinsic) {
    // https://graypaper.fluffylabs.dev/#/579bd12/12bb0312bb03
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
    // https://graypaper.fluffylabs.dev/#/579bd12/12690312bc03
    this.state.disputesRecords.goodSet = SortedSet.fromTwoSortedCollections(
      this.state.disputesRecords.goodSet,
      newItems.toAddToGoodSet,
    );
    this.state.disputesRecords.badSet = SortedSet.fromTwoSortedCollections(
      this.state.disputesRecords.badSet,
      newItems.toAddToBadSet,
    );
    this.state.disputesRecords.wonkySet = SortedSet.fromTwoSortedCollections(
      this.state.disputesRecords.wonkySet,
      newItems.toAddToWonkySet,
    );
    const toAddToPunishSet = SortedArray.fromArray(hashComparator, offenders);
    this.state.disputesRecords.punishSet = SortedSet.fromTwoSortedCollections(
      this.state.disputesRecords.punishSet,
      toAddToPunishSet,
    );
  }

  private prepareSignaturesToVerification(disputes: DisputesExtrinsic): Result<VerificationInput, DisputesErrorCode> {
    // Signature verification is heavy so we prepare data to verify it in the meantime,
    const signaturesToVerification: VerificationInput = { culprits: [], judgements: [], faults: [] };
    const currentEpoch = Math.floor(this.state.timeslot / this.context.epochLength);

    for (const { votesEpoch, votes, workReportHash } of disputes.verdicts) {
      const k = votesEpoch === currentEpoch ? this.state.currentValidatorData : this.state.previousValidatorData;
      for (const j of votes) {
        const validator = k[j.index];

        // no particular GP fragment but I think we don't believe in ghosts
        if (validator == null) {
          return Result.error(DisputesErrorCode.BadValidatorIndex);
        }

        const key = validator.ed25519;
        // verify vote signature
        // https://graypaper.fluffylabs.dev/#/579bd12/12cd0012cd00
        signaturesToVerification.judgements.push(prepareJudgementSignature(j, workReportHash, key));
      }
    }

    // verify culprit signature
    // https://graypaper.fluffylabs.dev/#/579bd12/125c01125c01
    signaturesToVerification.culprits = disputes.culprits.map(prepareCulpritSignature);

    // verify fault signature
    // https://graypaper.fluffylabs.dev/#/579bd12/12a90112a901
    signaturesToVerification.faults = disputes.faults.map(prepareFaultSignature);

    return Result.ok(signaturesToVerification);
  }

  async transition(disputes: DisputesExtrinsic): Promise<Result<Ed25519Key[], DisputesErrorCode>> {
    const signaturesToVerifyResult = this.prepareSignaturesToVerification(disputes);
    if (signaturesToVerifyResult.isError) {
      return Result.error(signaturesToVerifyResult.error);
    }

    const signaturesToVerify = signaturesToVerifyResult.ok;
    const verificationPromise = vefifyAllSignatures(signaturesToVerify);
    const v = this.calculateVotesForWorkReports(disputes);
    const newItems = this.getDisputesRecordsNewItems(v);

    const verificationResult = await verificationPromise;
    const inputError = [
      this.verifyVerdicts(disputes, verificationResult),
      this.verifyVotesForWorkReports(v, disputes),
      this.verifyCulprits(disputes, newItems, verificationResult),
      this.verifyFaults(disputes, newItems, verificationResult),
      this.verifyIfAlreadyJudged(disputes),
    ].find((result) => result.isError);

    if (inputError?.isError) {
      return Result.error(inputError.error);
    }

    // GP: https://graypaper.fluffylabs.dev/#/579bd12/131300133000
    const offendersMarks = this.getOffenders(disputes);
    this.updateDisputesRecords(newItems, offendersMarks);
    this.clearCoreAssignment(v);
    return Result.ok(offendersMarks);
  }
}
