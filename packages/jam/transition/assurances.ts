import type { HeaderHash, TimeSlot } from "@typeberry/block";
import type { AssurancesExtrinsicView } from "@typeberry/block/assurances.js";
import type { WorkReport } from "@typeberry/block/work-report.js";
import { BytesBlob } from "@typeberry/bytes";
import { asKnownSize, FixedSizeArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { ed25519 } from "@typeberry/crypto";
import type { DisputesStateUpdate } from "@typeberry/disputes";
import { blake2b } from "@typeberry/hash";
import type { State } from "@typeberry/state";
import { check, OK, Result } from "@typeberry/utils";

/** Assurances transition input. */
export type AssurancesInput = {
  /** A view of assurances extrinsic. */
  assurances: AssurancesExtrinsicView;
  /** Current header time slot. */
  slot: TimeSlot;
  /** Parent hash that all assurances need to be anchored at. */
  parentHash: HeaderHash;
  /**
   * ρ† - Availability assignment resulting from disputes transition:
   * https://graypaper.fluffylabs.dev/#/1c979cb/136900139e00?v=0.7.1
   */
  disputesAvailAssignment: DisputesStateUpdate["availabilityAssignment"];
};

/** State of the assurances. */
export type AssurancesState = Pick<State, "availabilityAssignment" | "currentValidatorData">;

/** State update of the assurances. */
export type AssurancesStateUpdate = Pick<AssurancesState, "availabilityAssignment">;

/** Possible error during assurances transition. */
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

/** Performs the transition of assurances state given some input. */
export class Assurances {
  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly state: AssurancesState,
  ) {}

  async transition(input: AssurancesInput): Promise<
    Result<
      {
        availableReports: WorkReport[];
        stateUpdate: AssurancesStateUpdate;
      },
      AssurancesError
    >
  > {
    const coresCount = this.chainSpec.coresCount;
    /**
     * The signature must be one whose public key is that of the validator assuring
     * and whose message is the serialization of the parent hash Hp and the
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

      check(bitfield.bitLength === coresCount, `Invalid bitfield length of ${bitfield.bitLength}`);
      const setBits = bitfield.indicesOfSetBits();
      for (const idx of setBits) {
        perCoreAssurances[idx] += 1;
      }
    }

    const availableReports: WorkReport[] = [];
    const coresToClear: number[] = [];
    const validatorsSuperMajority = this.chainSpec.validatorsSuperMajority;
    const availabilityAssignment = input.disputesAvailAssignment.slice();

    for (let c = 0; c < coresCount; c++) {
      const noOfAssurances = perCoreAssurances[c];
      const workReport = availabilityAssignment[c];
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
       * https://graypaper.fluffylabs.dev/#/1c979cb/141302144402?v=0.7.1
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

    /**
     * ρ‡ - equivalent to ρ† except for the removal of items
     * which are either now available or have timed out
     * https://graypaper.fluffylabs.dev/#/1c979cb/141302144402?v=0.7.1
     */
    for (const c of coresToClear) {
      availabilityAssignment[c] = null;
    }

    return Result.ok({
      availableReports,
      stateUpdate: {
        // Since we are copying the original array and only assigning to
        // existing cores, this cast is safe here.
        availabilityAssignment: asKnownSize(availabilityAssignment),
      },
    });
  }

  /** Asynchronously verify all signatures. */
  private async verifySignatures(assurances: AssurancesExtrinsicView): Promise<Result<OK, AssurancesError>> {
    const validatorData = this.state.currentValidatorData;
    const signatures: ed25519.Input<BytesBlob>[] = [];
    for (const assurance of assurances) {
      const v = assurance.view();
      const key = validatorData[v.validatorIndex.materialize()];
      if (key === undefined) {
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
        (acc, isValid, idx) => (isValid ? acc : acc.concat(idx)),
        [] as number[],
      );
      return Result.error(AssurancesError.InvalidSignature, `invalid signatures at ${invalidIndices.join(", ")}`);
    }

    return Result.ok(OK);
  }
}

const JAM_AVAILABLE = BytesBlob.blobFromString("jam_available").raw;

function signingPayload(anchor: BytesBlob, blob: BytesBlob): BytesBlob {
  return BytesBlob.blobFromParts(JAM_AVAILABLE, blake2b.hashBytes(BytesBlob.blobFromParts(anchor.raw, blob.raw)).raw);
}
