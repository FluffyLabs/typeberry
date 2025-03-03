import type { Ed25519Key, PerValidator, TimeSlot } from "@typeberry/block";
import type { GuaranteesExtrinsicView } from "@typeberry/block/guarantees";
import type { WorkPackageInfo } from "@typeberry/block/work-report";
import type { BytesBlob } from "@typeberry/bytes";
import { type KnownSizeArray, SortedSet, asKnownSize, bytesComparator } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { ed25519 } from "@typeberry/crypto";
import { type KeccakHash, WithHash, blake2b } from "@typeberry/hash";
import type { MmrHasher } from "@typeberry/mmr";
import { AvailabilityAssignment, type State } from "@typeberry/state";
import { OK, Result, check } from "@typeberry/utils";
import { ReportsError } from "./error";
import { generateCoreAssignment, rotationIndex } from "./guarantor-assignment";
import { verifyReportsBasic } from "./verify-basic";
import { type HeaderChain, verifyContextualValidity } from "./verify-contextual";
import { type GuarantorAssignment, verifyCredentials } from "./verify-credentials";
import { verifyReportsOrder } from "./verify-order";
import { verifyPostSignatureChecks } from "./verify-post-signature";

/**
 * Work Report is presented on-chain within `GuaranteesExtrinsic`
 * and then it's being erasure-codec and assured (i.e. voted available
 * by validators).
 *
 * After enough assurances the work-report is considered available,
 * and the work outputs transform the state of their associated
 * service by virtue of accumulation, covered in section 12.
 * The report may also be timed-out, implying it may be replaced
 * by another report without accumulation.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/133d00134200
 */
export type ReportsInput = {
  /**
   * A work-package, is transformed by validators acting as
   * guarantors into its corresponding work-report, which
   * similarly comprises several work outputs and then
   * presented on-chain within the guarantees extrinsic.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/133500133900
   */
  guarantees: GuaranteesExtrinsicView;
  /** Current time slot, excerpted from block header. */
  slot: TimeSlot;
};

export type ReportsState = Pick<
  State,
  | "availabilityAssignment"
  | "currentValidatorData"
  | "previousValidatorData"
  | "entropy"
  | "authPools"
  | "recentBlocks"
  | "services"
  | "accumulationQueue"
  | "recentlyAccumulated"
> & {
  // NOTE: this is most likely not strictly part of the state!
  // TODO [ToDr] Seems that section 11 does not specify when this should be updated.
  // I guess we need to check that later with the GP.
  readonly offenders: KnownSizeArray<Ed25519Key, "0..ValidatorsCount">;
};

export type ReportsOutput = {
  /** All work Packages and their segment roots reported in the extrinsic. */
  reported: KnownSizeArray<WorkPackageInfo, "Guarantees">;
  /** A set `R` of work package reporters. */
  reporters: KnownSizeArray<Ed25519Key, "Guarantees * Credentials (at most `cores*3`)">;
};

export class Reports {
  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly state: ReportsState,
    public readonly hasher: MmrHasher<KeccakHash>,
    public readonly headerChain: HeaderChain,
  ) {}

  async transition(input: ReportsInput): Promise<Result<ReportsOutput, ReportsError>> {
    // verify ordering of work reports.
    const reportsOrderResult = verifyReportsOrder(input.guarantees, this.chainSpec);
    if (reportsOrderResult.isError) {
      return reportsOrderResult;
    }

    // check some basic reports validity
    const reportsValidity = verifyReportsBasic(input.guarantees);
    if (reportsValidity.isError) {
      return reportsValidity;
    }

    // verifying credentials for all the work reports
    // but also slot & core assignment.
    // returns actual signatures that need to be checked (async)
    const signaturesToVerify = this.verifyCredentials(input);
    if (signaturesToVerify.isError) {
      return signaturesToVerify;
    }

    // Actually verify signatures
    const verifySignaturesLater = ed25519.verify(signaturesToVerify.ok);

    // Perform rest of the work in the meantime.
    const restResult = this.verifyPostSignatureChecks(input.guarantees);
    if (restResult.isError) {
      return restResult;
    }

    // confirm contextual validity
    const contextualValidity = this.verifyContextualValidity(input);
    if (contextualValidity.isError) {
      return contextualValidity;
    }

    // check signatures correctness
    const signaturesOk = this.checkSignatures(signaturesToVerify.ok, await verifySignaturesLater);
    if (signaturesOk.isError) {
      return signaturesOk;
    }

    /**
     * Replace availability assignment.
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/154c02154c02
     */
    for (const guarantee of input.guarantees) {
      // TODO [ToDr] clean up the code a bit (use transition hasher)
      const reportView = guarantee.view().report.view();
      this.state.availabilityAssignment[reportView.coreIndex.materialize()] = new AvailabilityAssignment(
        new WithHash(blake2b.hashBytes(reportView.encoded()).asOpaque(), reportView.materialize()),
        input.slot,
      );
    }

    return Result.ok({
      reported: asKnownSize(contextualValidity.ok),
      reporters: asKnownSize(
        SortedSet.fromArray(
          bytesComparator,
          signaturesToVerify.ok.map((x) => x.key),
        ).slice(),
      ),
    });
  }

  verifyCredentials(input: ReportsInput) {
    return verifyCredentials(input.guarantees, input.slot, (headerTimeSlot, guaranteeTimeSlot) =>
      this.getGuarantorAssignment(headerTimeSlot, guaranteeTimeSlot),
    );
  }

  verifyPostSignatureChecks(input: GuaranteesExtrinsicView) {
    return verifyPostSignatureChecks(
      input,
      this.state.availabilityAssignment,
      this.state.authPools,
      this.state.services,
    );
  }

  verifyContextualValidity(input: ReportsInput) {
    return verifyContextualValidity(input, this.state, this.hasher, this.headerChain);
  }

  checkSignatures(
    signaturesToVerify: ed25519.Input<BytesBlob>[],
    signaturesValid: boolean[],
  ): Result<OK, ReportsError> {
    if (signaturesValid.every((isValid) => isValid)) {
      return Result.ok(OK);
    }

    // we have invalid signatures, let's return nice error messages
    const invalidKeys = signaturesValid
      .map((isValid, idx) => {
        if (isValid) {
          return null;
        }
        return signaturesToVerify[idx].key;
      })
      .filter((x) => x);

    return Result.error(
      ReportsError.BadSignature,
      `Invalid signatures for validators with keys: ${invalidKeys.join(", ")}`,
    );
  }

  /**
   * Get the guarantor assignment (both core and validator data)
   * depending on the rotation.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/158200158200
   */
  getGuarantorAssignment(
    headerTimeSlot: TimeSlot,
    guaranteeTimeSlot: TimeSlot,
  ): Result<PerValidator<GuarantorAssignment>, ReportsError> {
    const epochLength = this.chainSpec.epochLength;
    const rotationPeriod = this.chainSpec.rotationPeriod;
    const headerRotation = rotationIndex(headerTimeSlot, rotationPeriod);
    const guaranteeRotation = rotationIndex(guaranteeTimeSlot, rotationPeriod);
    const minTimeSlot = Math.max(0, headerRotation - 1) * rotationPeriod;

    // https://graypaper.fluffylabs.dev/#/5f542d7/155e00156900
    if (guaranteeTimeSlot > headerTimeSlot || guaranteeTimeSlot < minTimeSlot) {
      // TODO [ToDr] The error from test vectors seems to suggest that the reports
      // will be rejected if they are from an older epoch,
      // but according to GP it seems that just being from a too-old rotation
      // is sufficient.
      const error =
        guaranteeTimeSlot > headerTimeSlot ? ReportsError.FutureReportSlot : ReportsError.ReportEpochBeforeLast;
      return Result.error(
        error,
        `Report slot is in future or too old. Block ${headerTimeSlot}, Report: ${guaranteeTimeSlot}`,
      );
    }

    // TODO [ToDr] [opti] below code needs cache.
    // The `G` and `G*` sets should only be computed once per rotation.

    // Default data for the current rotation
    let eta2entropy = this.state.entropy[2];
    let validatorData = this.state.currentValidatorData;
    let timeSlot = headerTimeSlot;

    // we might need a different set of data
    if (headerRotation > guaranteeRotation) {
      // we can safely subtract here, because if `guaranteeRotation` is less
      // than header rotation it must be greater than the `rotationPeriod`.
      timeSlot = (headerTimeSlot - rotationPeriod) as TimeSlot;

      // if the epoch changed, we need to take previous entropy and previous validator data.
      if (isPreviousRotationPreviousEpoch(timeSlot, headerTimeSlot, epochLength)) {
        eta2entropy = this.state.entropy[3];
        validatorData = this.state.previousValidatorData;
      }
    }

    // we know which entropy, timeSlot and validatorData should be used,
    // so we can compute `G` or `G*` here.
    const coreAssignment = generateCoreAssignment(this.chainSpec, eta2entropy, timeSlot);
    return Result.ok(
      zip(coreAssignment, validatorData, (core, validator) => ({
        core,
        ed25519: validator.ed25519,
      })),
    );
  }
}

function isPreviousRotationPreviousEpoch(
  previousRotationTimeSlot: TimeSlot,
  currentRotationTimeSlot: TimeSlot,
  epochLength: number,
) {
  const currentEpoch = Math.floor(currentRotationTimeSlot / epochLength);
  const maybePreviousEpoch = Math.floor(previousRotationTimeSlot / epochLength);
  const isPrevious = maybePreviousEpoch !== currentEpoch;
  return isPrevious;
}

/**
 * Compose two collections of the same size into a single one
 * containing some amalgamation of both items.
 */
function zip<A, B, R, F extends string>(
  a: KnownSizeArray<A, F>,
  b: KnownSizeArray<B, F>,
  fn: (a: A, b: B) => R,
): KnownSizeArray<R, F> {
  check(a.length === b.length, "Zip can be only used for collections of matching size.");

  return asKnownSize(
    a.map((aValue, index) => {
      return fn(aValue, b[index]);
    }),
  );
}
