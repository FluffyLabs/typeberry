import type { HeaderHash, TimeSlot, ValidatorData } from "@typeberry/block";
import type { AssurancesExtrinsicView } from "@typeberry/block/assurances";
import type { WorkReport } from "@typeberry/block/work-report";
import { BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray, type KnownSizeArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { ed25519 } from "@typeberry/crypto";
import type { AvailabilityAssignment } from "@typeberry/disputes";
import { blake2b } from "@typeberry/hash";
import { OK, Result, check } from "@typeberry/utils";
import type { PerCore } from "./authorization";

export type AssurancesInput = {
  assurances: AssurancesExtrinsicView;
  slot: TimeSlot;
  parentHash: HeaderHash;
};

export type PerValidator<T> = KnownSizeArray<T, "ValidatorsCount">;

export type AssurancesState = {
  /**
   * `rho`: work-reports which have been reported but are not yet known to be
   *        available to a super-majority of validators, together with the time
   *        at which each was reported.
   *
   *  https://graypaper.fluffylabs.dev/#/579bd12/135800135800
   */
  availabilityAssignment: PerCore<AvailabilityAssignment | null>;
  /**
   * `kappa`: Validators, who are the set of economic actors uniquely
   *          privileged to help build and maintain the Jam chain, are
   *          identified within κ, archived in λ and enqueued from ι.
   *
   *  https://graypaper.fluffylabs.dev/#/579bd12/080201080601
   */
  currentValidatorData: PerValidator<ValidatorData>;
};

export enum AssurancesError {
  /** Assurances must all be anchored in `parentHash`. */
  InvalidAnchor = 0,
  /** Assurances must be ordered by `validatorIndex`. */
  InvalidOrder = 1,
  /** One of the signatures is invalid. */
  InvalidSignature = 2,
  /** There is no report pending availability on a core which validator indicated assurance. */
  NoReportPending = 3,
  /** Unknown validator index. */
  InvalidValidatorIndex = 4,
}

/**
 * `U`: The period in timeslots after which reported but unavailable work may be replaced.
 *
 * https://graypaper.fluffylabs.dev/#/4bb8fd2/418300418500
 */
export const REPORT_TIMEOUT_GRACE_PERIOD = 5;

export class Assurances {
  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly state: AssurancesState,
  ) {}

  async transition(input: AssurancesInput): Promise<Result<WorkReport[], AssurancesError>> {
    const coresCount = this.chainSpec.coresCount;
    /**
     * The signature must be one whose public key is that of the validator assuring.
     * assuring and whose message is the serialization of the parent hash Hp and the
     * aforementioned bitstring.
     * https://graypaper.fluffylabs.dev/#/579bd12/14b40014b600
     */
    const signaturesVerification = this.verifySignatures(input.assurances);

    // materialize the assurances
    const assurances = input.assurances.map((x) => x.materialize());

    // calculate number of assurances for each of the core
    const perCoreAssurances = FixedSizeArray.new(Array(coresCount).fill(0), coresCount);

    /**
     * The assurances must all be anchored on the parent and ordered by validator index.
     * https://graypaper.fluffylabs.dev/#/579bd12/149a00149a00
     */
    let prevValidatorIndex = -1;
    for (const assurance of assurances) {
      const { anchor, validatorIndex, bitfield } = assurance;
      if (!anchor.isEqualTo(input.parentHash)) {
        return Result.error(AssurancesError.InvalidAnchor, `anchor: expected: ${input.parentHash}, got ${anchor}`);
      }

      if (prevValidatorIndex >= validatorIndex) {
        return Result.error(
          AssurancesError.InvalidOrder,
          `order: expected: ${prevValidatorIndex + 1}, got: ${validatorIndex}`,
        );
      }
      prevValidatorIndex = assurance.validatorIndex;

      // TODO [ToDr] This shouldn't be required if we have validation.
      check(bitfield.bitLength === coresCount, `Invalid bitfield length of ${bitfield.bitLength}`);
      const setBits = bitfield.indicesOfSetBits();
      for (const idx of setBits) {
        perCoreAssurances[idx] += 1;
      }
    }

    const availableReports: WorkReport[] = [];
    const coresToClear: number[] = [];
    const validatorsSuperMajority = this.chainSpec.validatorsSuperMajority;
    for (let c = 0; c < coresCount; c++) {
      const noOfAssurances = perCoreAssurances[c];
      const workReport = this.state.availabilityAssignment[c];
      const isReportPending = workReport !== null;
      /**
       * Verify if availability is pending: A bit may only be set if the corresponding
       * core has a report pending availability on it:
       * https://graypaper.fluffylabs.dev/#/579bd12/14e90014ea00
       */
      if (noOfAssurances > 0 && !isReportPending) {
        return Result.error(AssurancesError.NoReportPending, `no report pending for core ${c} yet we got an assurance`);
      }

      /**
       * Remove work report if it's became available or timed out.
       * https://graypaper.fluffylabs.dev/#/4bb8fd2/14f50014fd00
       */
      if (isReportPending) {
        if (input.slot >= workReport.timeout + REPORT_TIMEOUT_GRACE_PERIOD) {
          coresToClear.push(c);
        }
        if (noOfAssurances >= validatorsSuperMajority) {
          availableReports.push(workReport.workReport.data);
          coresToClear.push(c);
        }
      }
    }

    // asynchronously verify the signatures
    const allSignaturesValid = await signaturesVerification;
    if (allSignaturesValid.isError) {
      return allSignaturesValid;
    }

    // Only clear the state at the very end.
    for (const c of coresToClear) {
      this.state.availabilityAssignment[c] = null;
    }

    return Result.ok(availableReports);
  }

  async verifySignatures(assurances: AssurancesExtrinsicView): Promise<Result<OK, AssurancesError>> {
    const validatorData = this.state.currentValidatorData;
    const signatures: ed25519.Input<BytesBlob>[] = [];
    for (const assurance of assurances) {
      const v = assurance.view();
      const key = validatorData[v.validatorIndex.materialize()];
      // TODO [ToDr] This shouldn't be required if we have validation.
      if (!key) {
        return Result.error(AssurancesError.InvalidValidatorIndex);
      }
      signatures.push({
        signature: v.signature.materialize(),
        key: key.ed25519,
        message: signingPayload(v.anchor.encoded(), v.bitfield.encoded()),
      });
    }
    const signaturesValid = await ed25519.verify(signatures);

    const isAllSignaturesValid = signaturesValid.every((x) => x);
    if (!isAllSignaturesValid) {
      const invalidIndices = signaturesValid.reduce(
        (acc, isValid, idx) => (isValid ? acc : acc.concat([idx])),
        [] as number[],
      );
      return Result.error(AssurancesError.InvalidSignature, `invalid signatures at ${invalidIndices.join(", ")}`);
    }

    return Result.ok(OK);
  }
}

export const JAM_AVAILABLE = BytesBlob.blobFromString("jam_available").raw;

function signingPayload(anchor: BytesBlob, blob: BytesBlob): BytesBlob {
  return BytesBlob.blobFromParts(JAM_AVAILABLE, blake2b.hashBytes(BytesBlob.blobFromParts(anchor.raw, blob.raw)).raw);
}
