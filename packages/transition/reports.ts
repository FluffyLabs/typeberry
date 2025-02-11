import type { Ed25519Key, TimeSlot, WorkReportHash } from "@typeberry/block";
import type { GuaranteesExtrinsicView } from "@typeberry/block/guarantees";
import type { SegmentRootLookupItem } from "@typeberry/block/work-report";
import { BytesBlob } from "@typeberry/bytes";
import type { KnownSizeArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { blake2b } from "@typeberry/hash";
import type { State } from "@typeberry/state";
import { OK, Result, asOpaqueType } from "@typeberry/utils";

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
  // TODO [ToDr] length?
  reporters: Ed25519Key[];
};

/** Error that may happen during reports processing. */
export enum ReportsError {
  BadCoreIndex = 0,
  FutureReportSlot = 1,
  ReportEpochBeforeLast = 2,
  /** Not enough credentials for the guarantee. */
  InsufficientGuarantees = 3,
  /** Guarantees are not ordered by the core index. */
  OutOfOrderGuarantee = 4,
  /** Credentials of guarantors are not sorted or unique. */
  NotSortedOrUniqueGuarantors = 5,
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
  BadValidatorIndex = 16,
  WorkReportGasTooHigh = 17,
  ServiceItemGasTooLow = 18,
  TooManyDependencies = 19,
  SegmentRootLookupInvalid = 20,
  BadSignature = 21,
  WorkReportTooBig = 22,
}

export class Reports {
  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly state: ReportsState,
  ) {}

  transition(input: ReportsInput): Result<ReportsOutput, ReportsError> {
    const res1 = this.verifyReportsOrder(input.guarantees);
    if (res1.isError) {
      return Result.error(res1.error, res1.details);
    }

    const res2 = this.verifyCredentials(input);
    if (res2.isError) {
      return Result.error(res2.error, res2.details);
    }

    return Result.ok({
      reported: [],
      reporters: [],
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

  verifyCredentials(input: ReportsInput): Result<OK, ReportsError> {
    const signaturesForVerification = [];
    for (const guarantee of input.guarantees) {
      const guaranteeView = guarantee.view();
      /**
       * The credential is a sequence of two or three tuples of a
       * unique validator index and a signature.
       *
       * https://graypaper.fluffylabs.dev/#/5f542d7/14b90214bb02
       */
      const credentialsView = guaranteeView.credentials.view();
      if (credentialsView.length < 2 || credentialsView.length > 3) {
        return Result.error(ReportsError.InsufficientGuarantees);
      }

      const timeslot = guaranteeView.slot.materialize();
      const workReportHash = asOpaqueType(blake2b.hashBytes(guaranteeView.report.encoded()));
      /** Credentials must be ordered by their validator index. */
      const lastValidatorIndex = -1;
      for (const credential of credentialsView) {
        const credentialView = credential.view();
        const validatorIndex = credentialView.validatorIndex.materialize();

        if (lastValidatorIndex >= validatorIndex) {
          return Result.error(
            ReportsError.NotSortedOrUniqueGuarantors,
            `Credentials must be sorted by validator index. Got ${validatorIndex}, expected ${lastValidatorIndex + 1}`,
          );
        }

        const signature = credentialView.signature.materialize();
        const validatorData = this.state.currentValidatorData[validatorIndex];
        if (validatorData === undefined) {
          return Result.error(ReportsError.BadValidatorIndex, `Invalid validator index: ${validatorIndex}`);
        }

        signaturesForVerification.push({
          signature,
          key: validatorData.ed25519,
          message: signingPayload(workReportHash),
        });
      }
    }

    // TODO [ToDr] Verify signatures

    // TODO [ToDr] verify validator-core assignment?
    // https://graypaper.fluffylabs.dev/#/5f542d7/140c02140c02

    return Result.ok(OK);
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
