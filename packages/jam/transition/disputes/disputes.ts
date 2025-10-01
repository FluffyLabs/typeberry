import type { WorkReportHash } from "@typeberry/block";
import type { DisputesExtrinsic } from "@typeberry/block/disputes.js";
import { HashDictionary, HashSet, SortedArray, SortedSet } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { Ed25519Key } from "@typeberry/crypto";
import {
  type AvailabilityAssignment,
  DisputesRecords,
  hashComparator,
  type PerCore,
  tryAsPerCore,
} from "@typeberry/state";
import { Result } from "@typeberry/utils";
import { DisputesErrorCode } from "./disputes-error-code.js";
import type { DisputesState, DisputesStateUpdate } from "./disputes-state.js";
import { isUniqueSortedBy, isUniqueSortedByIndex } from "./sort-utils.js";
import {
  prepareCulpritSignature,
  prepareFaultSignature,
  prepareJudgementSignature,
  type VerificationInput,
  type VerificationOutput,
  vefifyAllSignatures,
} from "./verification-utils.js";

type VotesForWorkReports = HashDictionary<WorkReportHash, number>;

type Ok = null;
export class Disputes {
  constructor(
    private readonly chainSpec: ChainSpec,
    public readonly state: DisputesState,
  ) {}

  private verifyCulprits(
    disputes: DisputesExtrinsic,
    newItems: DisputesRecords,
    verificationResult: VerificationOutput,
    allValidatorKeys: HashSet<Ed25519Key>,
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
      const isInPunishSet = this.state.disputesRecords.asDictionaries().punishSet.has(key);
      if (isInPunishSet) {
        return Result.error(DisputesErrorCode.OffenderAlreadyReported);
      }

      // check if the guarantor key is correct
      // https://graypaper.fluffylabs.dev/#/85129da/125501125501?v=0.6.3
      if (!allValidatorKeys.has(key)) {
        return Result.error(DisputesErrorCode.BadGuarantorKey);
      }

      // verify if the culprit will be in new bad set
      // https://graypaper.fluffylabs.dev/#/579bd12/124601124601
      const isInNewBadSet = newItems.asDictionaries().badSet.has(workReportHash);
      if (!isInNewBadSet) {
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
    newItems: DisputesRecords,
    verificationResult: VerificationOutput,
    allValidatorKeys: HashSet<Ed25519Key>,
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
      const isInPunishSet = this.state.disputesRecords.asDictionaries().punishSet.has(key);

      if (isInPunishSet) {
        return Result.error(DisputesErrorCode.OffenderAlreadyReported);
      }

      // check if the auditor key is correct
      // https://graypaper.fluffylabs.dev/#/85129da/12a20112a201?v=0.6.3
      if (!allValidatorKeys.has(key)) {
        return Result.error(DisputesErrorCode.BadAuditorKey);
      }

      // verify if the fault will be included in new good/bad set
      // it may be not correct as in GP there is "iff" what means it should be rather
      // if (!wasConsideredValid || isInNewGoodSet || !isInNewBadSet) return DisputesErrorCode.FaultVerdictWrong;
      // but it does not pass the tests
      // https://graypaper.fluffylabs.dev/#/579bd12/128a01129601
      if (wasConsideredValid) {
        const { goodSet, badSet } = newItems.asDictionaries();
        const isInNewGoodSet = goodSet.has(workReportHash);
        const isInNewBadSet = badSet.has(workReportHash);

        if (isInNewGoodSet || !isInNewBadSet) {
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

    const currentEpoch = Math.floor(this.state.timeslot / this.chainSpec.epochLength);
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
        if (key === undefined) {
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
      const { goodSet, badSet, wonkySet } = this.state.disputesRecords.asDictionaries();
      const isInGoodSet = goodSet.has(verdict.workReportHash);
      const isInBadSet = badSet.has(verdict.workReportHash);
      const isInWonkySet = wonkySet.has(verdict.workReportHash);

      if (isInGoodSet || isInBadSet || isInWonkySet) {
        return Result.error(DisputesErrorCode.AlreadyJudged);
      }
    }

    return Result.ok(null);
  }

  private calculateVotesForWorkReports(disputes: DisputesExtrinsic) {
    // calculate total votes for each work report
    // https://graypaper.fluffylabs.dev/#/579bd12/128c0212e302
    const v = HashDictionary.new<WorkReportHash, number>();

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
      if (sum === this.chainSpec.validatorsSuperMajority) {
        // there has to be at least 1 fault with the same work report hash
        // https://graypaper.fluffylabs.dev/#/579bd12/12f10212fc02
        const f = disputes.faults.find((x) => x.workReportHash.isEqualTo(r));
        if (f === undefined) {
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
      } else if (sum !== this.chainSpec.thirdOfValidators) {
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
      if (sum >= this.chainSpec.validatorsSuperMajority) {
        toAddToGoodSet.push(r);
      } else if (sum === 0) {
        toAddToBadSet.push(r);
      } else if (sum >= this.chainSpec.thirdOfValidators) {
        toAddToWonkySet.push(r);
      }
    }

    return DisputesRecords.create({
      goodSet: SortedSet.fromArrayUnique(hashComparator, toAddToGoodSet),
      badSet: SortedSet.fromArrayUnique(hashComparator, toAddToBadSet),
      wonkySet: SortedSet.fromArrayUnique(hashComparator, toAddToWonkySet),
      punishSet: SortedSet.fromArray<Ed25519Key>(hashComparator, []),
    });
  }

  private getClearedCoreAssignment(v: VotesForWorkReports): PerCore<AvailabilityAssignment | null> {
    /**
     * ρ†
     * We clear any work-reports which we judged as uncertain or invalid from their core.
     * https://graypaper.fluffylabs.dev/#/1c979cb/136900139e00?v=0.7.1
     */
    const availabilityAssignment = this.state.availabilityAssignment.slice();
    for (let c = 0; c < availabilityAssignment.length; c++) {
      const assignment = availabilityAssignment[c];
      if (assignment !== null) {
        const sum = v.get(assignment.workReport.hash);
        if (sum !== undefined && sum < this.chainSpec.validatorsSuperMajority) {
          availabilityAssignment[c] = null;
        }
      }
    }
    return tryAsPerCore(availabilityAssignment, this.chainSpec);
  }

  private getOffenders(disputes: DisputesExtrinsic) {
    // https://graypaper.fluffylabs.dev/#/579bd12/12bb0312bb03
    const offendersMarks = HashSet.new<Ed25519Key>();

    for (const { key } of disputes.culprits) {
      offendersMarks.insert(key);
    }

    for (const { key } of disputes.faults) {
      offendersMarks.insert(key);
    }

    return offendersMarks;
  }

  private getUpdatedDisputesRecords(newItems: DisputesRecords, offenders: HashSet<Ed25519Key>): DisputesRecords {
    const toAddToPunishSet = SortedArray.fromArray(hashComparator, Array.from(offenders));
    return DisputesRecords.create({
      // https://graypaper.fluffylabs.dev/#/579bd12/12690312bc03
      goodSet: SortedSet.fromTwoSortedCollections(this.state.disputesRecords.goodSet, newItems.goodSet),
      badSet: SortedSet.fromTwoSortedCollections(this.state.disputesRecords.badSet, newItems.badSet),
      wonkySet: SortedSet.fromTwoSortedCollections(this.state.disputesRecords.wonkySet, newItems.wonkySet),
      punishSet: SortedSet.fromTwoSortedCollections(this.state.disputesRecords.punishSet, toAddToPunishSet),
    });
  }

  private prepareSignaturesToVerification(disputes: DisputesExtrinsic): Result<VerificationInput, DisputesErrorCode> {
    // Signature verification is heavy so we prepare data to verify it in the meantime,
    const signaturesToVerification: VerificationInput = { culprits: [], judgements: [], faults: [] };
    const currentEpoch = Math.floor(this.state.timeslot / this.chainSpec.epochLength);

    for (const { votesEpoch, votes, workReportHash } of disputes.verdicts) {
      const k = votesEpoch === currentEpoch ? this.state.currentValidatorData : this.state.previousValidatorData;
      for (const j of votes) {
        const validator = k[j.index];

        // no particular GP fragment but I think we don't believe in ghosts
        if (validator === undefined) {
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

  private getValidatorKeys() {
    const punishSetKeys = this.state.disputesRecords.punishSet;
    const currentValidatorKeys = this.state.currentValidatorData.map((v) => v.ed25519);
    const previousValidatorKeys = this.state.previousValidatorData.map((v) => v.ed25519);
    const allValidatorKeys = currentValidatorKeys
      .concat(previousValidatorKeys)
      .filter((key) => !punishSetKeys.has(key));

    return HashSet.from(allValidatorKeys);
  }

  /**
   * Transition the disputes and return a list of offenders.
   */
  async transition(disputes: DisputesExtrinsic): Promise<
    Result<
      {
        offendersMark: HashSet<Ed25519Key>;
        stateUpdate: DisputesStateUpdate;
      },
      DisputesErrorCode
    >
  > {
    const signaturesToVerifyResult = this.prepareSignaturesToVerification(disputes);
    if (signaturesToVerifyResult.isError) {
      return Result.error(signaturesToVerifyResult.error);
    }

    const signaturesToVerify = signaturesToVerifyResult.ok;
    const verificationPromise = vefifyAllSignatures(signaturesToVerify);
    const v = this.calculateVotesForWorkReports(disputes);
    const newItems = this.getDisputesRecordsNewItems(v);

    const verificationResult = await verificationPromise;

    const allValidatorKeys = this.getValidatorKeys();

    const inputError = [
      this.verifyVerdicts(disputes, verificationResult),
      this.verifyVotesForWorkReports(v, disputes),
      this.verifyCulprits(disputes, newItems, verificationResult, allValidatorKeys),
      this.verifyFaults(disputes, newItems, verificationResult, allValidatorKeys),
      this.verifyIfAlreadyJudged(disputes),
    ].find((result) => result.isError);

    if (inputError?.isError) {
      return Result.error(inputError.error);
    }

    // GP: https://graypaper.fluffylabs.dev/#/579bd12/131300133000
    const offendersMark = this.getOffenders(disputes);
    const disputesRecords = this.getUpdatedDisputesRecords(newItems, offendersMark);
    const availabilityAssignment = this.getClearedCoreAssignment(v);

    return Result.ok({
      offendersMark,
      stateUpdate: {
        disputesRecords,
        availabilityAssignment,
      },
    });
  }
}
