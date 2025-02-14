import type { CoreIndex, Ed25519Key, PerValidator, TimeSlot, WorkReportHash } from "@typeberry/block";
import { type GuaranteesExtrinsicView, REQUIRED_CREDENTIALS_RANGE } from "@typeberry/block/guarantees";
import type { SegmentRootLookupItem } from "@typeberry/block/work-report";
import { BytesBlob } from "@typeberry/bytes";
import { type KnownSizeArray, asKnownSize } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { ed25519 } from "@typeberry/crypto";
import { blake2b } from "@typeberry/hash";
import type { State } from "@typeberry/state";
import { OK, Result, asOpaqueType, check } from "@typeberry/utils";
import { ROTATION_PERIOD, generateCoreAssignment, rotationIndex } from "./guarantor-assignment";

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

export type ReportsState = {
  readonly availabilityAssignment: State["availabilityAssignment"];
  readonly currentValidatorData: State["currentValidatorData"];
  readonly previousValidatorData: State["previousValidatorData"];
  readonly entropy: State["entropy"];
  readonly authPools: State["authPools"];
  readonly recentBlocks: State["recentBlocks"];
  readonly services: State["services"];

  // NOTE: this is most likely not strictly part of the state!
  readonly offenders: KnownSizeArray<Ed25519Key, "0..ValidatorsCount">;
};

export type ReportsOutput = {
  // TODO [ToDr] length?
  reported: SegmentRootLookupItem[];
  reporters: KnownSizeArray<Ed25519Key, "Guarantees * Credentials (at most `cores*3`)">;
};

/** Error that may happen during reports processing. */
export enum ReportsError {
  /** Core index is greater than the number of available cores. */
  BadCoreIndex = 0,
  /** The report slot is greater than the current block slot. */
  FutureReportSlot = 1,
  /** Report is too old to be considered. */
  ReportEpochBeforeLast = 2,
  /** Not enough credentials for the guarantee. */
  InsufficientGuarantees = 3,
  /** Guarantees are not ordered by the core index. */
  OutOfOrderGuarantee = 4,
  /** Credentials of guarantors are not sorted or unique. */
  NotSortedOrUniqueGuarantors = 5,
  /** Validator in credentials is assigned to a different core. */
  WrongAssignment = 6,
  CoreEngaged = 7,
  AnchorNotRecent = 8,
  BadServiceId = 9,
  BadCodeHash = 10,
  DependencyMissing = 11,
  DuplicatePackage = 12,
  BadStateRoot = 13,
  BadBeefyMmrRoot = 14,
  CoreUnauthorized = 15,
  /** Validator index is greater than the number of validators. */
  BadValidatorIndex = 16,
  WorkReportGasTooHigh = 17,
  ServiceItemGasTooLow = 18,
  TooManyDependencies = 19,
  SegmentRootLookupInvalid = 20,
  BadSignature = 21,
  WorkReportTooBig = 22,
}

type GuarantorAssignment = {
  core: CoreIndex;
  ed25519: Ed25519Key;
};

export class Reports {
  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly state: ReportsState,
  ) {}

  async transition(input: ReportsInput): Promise<Result<ReportsOutput, ReportsError>> {
    const reportsOrderResult = this.verifyReportsOrder(input.guarantees);
    if (reportsOrderResult.isError) {
      return reportsOrderResult;
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

    // TODO [ToDr] Perform rest of the work in the meantime.


    const signaturesValid = await verifySignaturesLater;
    if (signaturesValid.some(isValid => !isValid)) {
      // we have invalid signatures, let's return nice error messages
      const invalidKeys = signaturesValid.map((isValid, idx) => {
        if (isValid) {
          return null;
        }
        return signaturesToVerify.ok[idx].key;
      }).filter(x => x);
      return Result.error(
        ReportsError.BadSignature,
        `Invalid signatures for validators with keys: ${invalidKeys.join(', ')}`
      );
    }

    return Result.ok({
      reported: [],
      reporters: asKnownSize([]),
    });
  }

  verifyReportsOrder(input: GuaranteesExtrinsicView): Result<OK, ReportsError> {
    /**
     * The core index of each guarantee must be unique and
     * guarantees must be in ascending order of this.
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/146902146a02
     */
    const noOfCores = this.chainSpec.coresCount;
    let lastCoreIndex = -1;
    for (const guarantee of input) {
      const reportView = guarantee.view().report.view();
      const coreIndex = reportView.coreIndex.materialize();
      if (lastCoreIndex >= coreIndex) {
        return Result.error(
          ReportsError.OutOfOrderGuarantee,
          `Core indices of work reports are not unique or in order. Got: ${coreIndex}, expected: ${lastCoreIndex + 1}`,
        );
      }
      if (coreIndex >= noOfCores) {
        return Result.error(ReportsError.BadCoreIndex, `Invalid core index. Got: ${coreIndex}, max: ${noOfCores}`);
      }
      lastCoreIndex = coreIndex;
    }

    return Result.ok(OK);
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
    const headerRotation = rotationIndex(headerTimeSlot);
    const guaranteeRotation = rotationIndex(guaranteeTimeSlot);
    const minTimeSlot = Math.max(0, headerRotation - 1) * ROTATION_PERIOD;

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
      // than header rotation it must be greater than the `ROTATION_PERIOD`.
      timeSlot = (headerTimeSlot - ROTATION_PERIOD) as TimeSlot;

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

  /**
   * Verify guarantee credentials and return the signatures to verification.
   */
  verifyCredentials(input: ReportsInput): Result<ed25519.Input[], ReportsError> {
    /**
     * Collect signatures payload for later verification
     * and construct the `reporters set R` from that data.
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/15cf0015cf00
     */
    const signaturesToVerify: ed25519.Input[] = [];
    const headerTimeSlot = input.slot;
    for (const guarantee of input.guarantees) {
      const guaranteeView = guarantee.view();
      const coreIndex = guaranteeView.report.view().coreIndex.materialize();
      const workReportHash: WorkReportHash = asOpaqueType(blake2b.hashBytes(guaranteeView.report.encoded()));
      /**
       * The credential is a sequence of two or three tuples of a
       * unique validator index and a signature.
       *
       * https://graypaper.fluffylabs.dev/#/5f542d7/14b90214bb02
       */
      const credentialsView = guaranteeView.credentials.view();
      if (
        credentialsView.length < REQUIRED_CREDENTIALS_RANGE[0] ||
        credentialsView.length > REQUIRED_CREDENTIALS_RANGE[1]
      ) {
        return Result.error(
          ReportsError.InsufficientGuarantees,
          `Invalid number of credentials. Expected ${REQUIRED_CREDENTIALS_RANGE}, got ${credentialsView.length}`,
        );
      }

      /** Retrieve current core assignment. */
      const timeSlot = guaranteeView.slot.materialize();
      const maybeGuarantorAssignments = this.getGuarantorAssignment(headerTimeSlot, timeSlot);
      if (maybeGuarantorAssignments.isError) {
        return maybeGuarantorAssignments;
      }
      const guarantorAssignments = maybeGuarantorAssignments.ok;

      /** Credentials must be ordered by their validator index. */
      let lastValidatorIndex = -1;
      for (const credential of credentialsView) {
        const credentialView = credential.view();
        const validatorIndex = credentialView.validatorIndex.materialize();

        if (lastValidatorIndex >= validatorIndex) {
          return Result.error(
            ReportsError.NotSortedOrUniqueGuarantors,
            `Credentials must be sorted by validator index. Got ${validatorIndex}, expected ${lastValidatorIndex + 1}`,
          );
        }

        lastValidatorIndex = validatorIndex;

        const signature = credentialView.signature.materialize();
        const guarantorData = guarantorAssignments[validatorIndex];
        if (guarantorData === undefined) {
          return Result.error(ReportsError.BadValidatorIndex, `Invalid validator index: ${validatorIndex}`);
        }

        /**
         * Verify core assignment.
         * https://graypaper.fluffylabs.dev/#/5f542d7/14e40214e602
         */
        if (guarantorData.core !== coreIndex) {
          return Result.error(
            ReportsError.WrongAssignment,
            `Invalid core assignment for validator ${validatorIndex}. Expected: ${guarantorData.core}, got: ${coreIndex}`,
          );
        }

        signaturesToVerify.push({
          signature,
          key: guarantorData.ed25519,
          message: signingPayload(workReportHash),
        });
      }
    }
    // TODO [ToDr] Verify signatures

    return Result.ok(signaturesToVerify);
  }
}

const JAM_GUARANTEE = BytesBlob.blobFromString("jam_guarantee").raw;

/**
 * The signature [...] whose message is the serialization of the hash
 * of the work-report.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/155200155200
 */
function signingPayload(hash: WorkReportHash) {
  return BytesBlob.blobFromParts(JAM_GUARANTEE, hash.raw);
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
