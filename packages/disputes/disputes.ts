import type { Ed25519Key, WorkReportHash } from "@typeberry/block";
import type { DisputesExtrinsic } from "@typeberry/block/disputes";
import { HashDictionary, SortedSet } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { hashBytes } from "@typeberry/hash";
import { Result } from "@typeberry/utils";
import { DisputesErrorCode } from "./disputes-error-code";
import { type DisputesState, hashComparator } from "./disputes-state";
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

const JUDGEMENT_INDEX = 0;
const CULPRITS_INDEX = 1;
const FAULTS_INDEX = 2;

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
    for (const { key, workReportHash, signature } of disputes.culprits) {
      // check if some offenders weren't reported earlier
      // https://graypaper.fluffylabs.dev/#/364735a/123e01123e01
      const isInPunishSet = !!this.state.disputesRecords.punishSet.findExact(key);
      if (isInPunishSet) {
        return Result.error(DisputesErrorCode.OffenderAlreadyReported);
      }

      // verify if the culprit will be in new bad set
      // https://graypaper.fluffylabs.dev/#/364735a/122f01122f01
      const isInNewBadSet = newItems.toAddToBadSet.findExact(workReportHash);
      if (!isInNewBadSet) {
        return Result.error(DisputesErrorCode.CulpritsVerdictNotBad);
      }

      // verify culprit signature
      // https://graypaper.fluffylabs.dev/#/364735a/124501124501
      const result = verificationResult[CULPRITS_INDEX].find((f) => f.signature.isEqualTo(signature));
      if (!result || !result.isValid) {
        return Result.error(DisputesErrorCode.BadSignature);
      }
    }

    // check if culprits are sorted by key
    // this check it should be done as as the first one (because it is cheap)
    // but one test (progress_with_bad_signatures-2.json) has 2 problems and order is important
    // https://graypaper.fluffylabs.dev/#/364735a/12ae0112af01
    //
    // TODO [MaSi]: Move it to the first line when progress_with_bad_signatures-2.json is fixed.
    if (!isUniqueSortedBy(disputes.culprits, "key")) {
      return Result.error(DisputesErrorCode.CulpritsNotSortedUnique);
    }

    return Result.ok(null);
  }

  private verifyFaults(
    disputes: DisputesExtrinsic,
    newItems: NewDisputesRecordsItems,
    verificationResult: VerificationOutput,
  ): Result<Ok, DisputesErrorCode> {
    // check if faults are sorted by key
    // https://graypaper.fluffylabs.dev/#/364735a/12ae0112af01
    if (!isUniqueSortedBy(disputes.faults, "key")) {
      return Result.error(DisputesErrorCode.FaultsNotSortedUnique);
    }

    for (const { key, workReportHash, signature, wasConsideredValid } of disputes.faults) {
      // check if some offenders weren't reported earlier
      // https://graypaper.fluffylabs.dev/#/364735a/128b01128b01
      const isInPunishSet = !!this.state.disputesRecords.punishSet.findExact(key);

      if (isInPunishSet) {
        return Result.error(DisputesErrorCode.OffenderAlreadyReported);
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
          return Result.error(DisputesErrorCode.FaultVerdictWrong);
        }
      }

      // verify fault signature. Verification was done earlier, here we only check the result.
      // https://graypaper.fluffylabs.dev/#/364735a/129201129201
      const result = verificationResult[FAULTS_INDEX].find((f) => f.signature.isEqualTo(signature));
      if (!result || !result.isValid) {
        return Result.error(DisputesErrorCode.BadSignature);
      }
    }

    return Result.ok(null);
  }

  private verifyVerdicts(
    disputes: DisputesExtrinsic,
    verificationResult: VerificationOutput,
  ): Result<Ok, DisputesErrorCode> {
    // check if judgement are correctly sorted
    // https://graypaper.fluffylabs.dev/#/364735a/122102122202
    if (!disputes.verdicts.every((verdict) => isUniqueSortedByIndex(verdict.votes))) {
      return Result.error(DisputesErrorCode.JudgementsNotSortedUnique);
    }

    const currentEpoch = Math.floor(this.state.timeslot / this.context.epochLength);
    for (const { votesEpoch, votes } of disputes.verdicts) {
      // https://graypaper.fluffylabs.dev/#/364735a/12a50012a600
      if (votesEpoch !== currentEpoch && votesEpoch + 1 !== currentEpoch) {
        return Result.error(DisputesErrorCode.BadJudgementAge);
      }

      const k = votesEpoch === currentEpoch ? this.state.currentValidatorData : this.state.previousValidatorData;
      for (const { index, signature } of votes) {
        const key = k[index]?.ed25519;

        // no particular GP fragment but I think we don't belive in ghosts
        if (!key) {
          return Result.error(DisputesErrorCode.BadValidatorIndex);
        }

        // verify vote signature. Verification was done earlier, here we only check the result.
        // https://graypaper.fluffylabs.dev/#/364735a/12b70012b700
        const result = verificationResult[JUDGEMENT_INDEX].find((j) => j.signature.isEqualTo(signature));
        if (!result || !result.isValid) {
          return Result.error(DisputesErrorCode.BadSignature);
        }
      }
    }

    // check if verdicts are correctly sorted
    // https://graypaper.fluffylabs.dev/#/364735a/12ad0112ad01
    if (!isUniqueSortedBy(disputes.verdicts, "workReportHash")) {
      return Result.error(DisputesErrorCode.VerdictsNotSortedUnique);
    }

    return Result.ok(null);
  }

  private verifyIfAlreadyJudged(disputes: DisputesExtrinsic): Result<Ok, DisputesErrorCode> {
    for (const verdict of disputes.verdicts) {
      // current verdicts should not be reported earlier
      // https://graypaper.fluffylabs.dev/#/364735a/120b02120b02
      const isInGoodSet = this.state.disputesRecords.goodSet.findExact(verdict.workReportHash);
      const isInBadSet = this.state.disputesRecords.badSet.findExact(verdict.workReportHash);
      const isInWonkySet = this.state.disputesRecords.wonkySet.findExact(verdict.workReportHash);

      if (isInGoodSet || isInBadSet || isInWonkySet) {
        return Result.error(DisputesErrorCode.AlreadyJudged);
      }
    }

    return Result.ok(null);
  }

  private calculateVotesForWorkReports(disputes: DisputesExtrinsic) {
    // calculate total votes for each work report
    // https://graypaper.fluffylabs.dev/#/364735a/12760212cd02
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
    // verify if the vote split is correct and if number of faults/culprints is correct
    // https://graypaper.fluffylabs.dev/#/364735a/12e50212fa02

    for (const [r, sum] of v) {
      if (sum === this.context.validatorsSuperMajority) {
        // there has to be at least 1 fault with the same work report hash
        // https://graypaper.fluffylabs.dev/#/364735a/12db0212e602
        const f = disputes.faults.find((x) => x.workReportHash.isEqualTo(r));
        if (!f) {
          return Result.error(DisputesErrorCode.NotEnoughFaults);
        }
      } else if (sum === 0) {
        // there has to be at least 2 culprits with the same work report hash
        // https://graypaper.fluffylabs.dev/#/364735a/12f60212fa02
        const c1 = disputes.culprits.find((x) => x.workReportHash.isEqualTo(r));
        const c2 = disputes.culprits.findLast((x) => x.workReportHash.isEqualTo(r));
        if (c1 === c2) {
          return Result.error(DisputesErrorCode.NotEnoughCulprits);
        }
      } else if (sum !== this.context.thirdOfValidators) {
        // positive votes count is not correct
        // https://graypaper.fluffylabs.dev/#/364735a/123a02126b02
        return Result.error(DisputesErrorCode.BadVoteSplit);
      }
    }

    return Result.ok(null);
  }

  private getDisputesRecordsNewItems(v: VotesForWorkReports) {
    const toAddToGoodSet = SortedSet.fromArray<WorkReportHash>(hashComparator);
    const toAddToBadSet = SortedSet.fromArray<WorkReportHash>(hashComparator);
    const toAddToWonkySet = SortedSet.fromArray<WorkReportHash>(hashComparator);

    // prepare new disputes records items but do not update the state yet
    // the state will be updated after verification
    // https://graypaper.fluffylabs.dev/#/364735a/123403128f03
    for (const [r, sum] of v) {
      if (sum >= this.context.validatorsSuperMajority) {
        toAddToGoodSet.insert(r);
      } else if (sum === 0) {
        toAddToBadSet.insert(r);
      } else if (sum >= this.context.thirdOfValidators) {
        toAddToWonkySet.insert(r);
      }
    }

    return { toAddToGoodSet, toAddToBadSet, toAddToWonkySet };
  }

  private clearCoreAssignment(v: VotesForWorkReports) {
    // https://graypaper.fluffylabs.dev/#/364735a/120403122903
    for (let c = 0; c < this.state.availabilityAssignment.length; c++) {
      const assignment = this.state.availabilityAssignment[c];
      if (assignment) {
        const hash = hashBytes(assignment.workReport) as WorkReportHash;
        const item = v.get(hash);
        if (item !== undefined && item < this.context.validatorsSuperMajority) {
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

  private prepareSignaturesToVerification(disputes: DisputesExtrinsic): Result<VerificationInput, DisputesErrorCode> {
    // Signature verification is heavy so we prepare array to verify it in the meantime,
    const signaturesToVerification: VerificationInput = [[], [], []];
    const currentEpoch = Math.floor(this.state.timeslot / this.context.epochLength);

    for (const { votesEpoch, votes, workReportHash } of disputes.verdicts) {
      const k = votesEpoch === currentEpoch ? this.state.currentValidatorData : this.state.previousValidatorData;
      for (const j of votes) {
        const validator = k[j.index];

        // no particular GP fragment but I think we don't belive in ghosts
        if (!validator) {
          return Result.error(DisputesErrorCode.BadValidatorIndex);
        }

        const key = validator.ed25519;
        // verify vote signature
        // https://graypaper.fluffylabs.dev/#/364735a/12b70012b700
        signaturesToVerification[JUDGEMENT_INDEX].push(prepareJudgementSignature(j, workReportHash, key));
      }
    }

    // verify culprit signature
    // https://graypaper.fluffylabs.dev/#/364735a/124501124501
    signaturesToVerification[CULPRITS_INDEX] = disputes.culprits.map(prepareCulpritSignature);

    // verify fault signature
    // https://graypaper.fluffylabs.dev/#/364735a/129201129201
    signaturesToVerification[FAULTS_INDEX] = disputes.faults.map(prepareFaultSignature);

    return Result.ok(signaturesToVerification);
  }

  async transition(disputes: DisputesExtrinsic): Promise<Result<Ed25519Key[], DisputesErrorCode>> {
    const signaturesToVerifyResult = this.prepareSignaturesToVerification(disputes);
    if (signaturesToVerifyResult.isError()) {
      return Result.error(signaturesToVerifyResult.error);
    }

    /** becasue of the condition above this should be always true but TS is stupid */
    const signaturesToVerify = signaturesToVerifyResult.isOk() ? signaturesToVerifyResult.ok : [];
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
    ].find((result) => result.isError());

    if (inputError?.isError()) {
      return Result.error(inputError.error);
    }

    // GP: https://graypaper.fluffylabs.dev/#/364735a/12b00312cd03
    const offendersMarks = this.getOffenders(disputes);
    this.updateDisputesRecords(newItems, offendersMarks);
    this.clearCoreAssignment(v);
    return Result.ok(offendersMarks);
  }
}
