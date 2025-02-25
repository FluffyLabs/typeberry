import type { CoreIndex, Ed25519Key, HeaderHash, PerValidator, TimeSlot, WorkReportHash } from "@typeberry/block";
import { G_A, L } from "@typeberry/block/gp-constants";
import { type GuaranteesExtrinsicView, REQUIRED_CREDENTIALS_RANGE } from "@typeberry/block/guarantees";
import type { RefineContext } from "@typeberry/block/refine-context";
import { type ExportsRootHash, type WorkPackageHash, WorkPackageInfo } from "@typeberry/block/work-report";
import { BytesBlob } from "@typeberry/bytes";
import { HashDictionary, type KnownSizeArray, asKnownSize } from "@typeberry/collections";
import { HashSet } from "@typeberry/collections/hash-set";
import type { ChainSpec } from "@typeberry/config";
import { ed25519 } from "@typeberry/crypto";
import { type KeccakHash, blake2b } from "@typeberry/hash";
import { MerkleMountainRange, type MmrHasher } from "@typeberry/mmr";
import { sumU64 } from "@typeberry/numbers";
import type { BlockState, State } from "@typeberry/state";
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
  readonly offenders: KnownSizeArray<Ed25519Key, "0..ValidatorsCount">;
};

export type ReportsOutput = {
  // TODO [ToDr] length?
  reported: WorkPackageInfo[];
  /** A set `R` of work package reporters. */
  reporters: KnownSizeArray<Ed25519Key, "Guarantees * Credentials (at most `cores*3`)">;
};

/** Recently imported blocks. */
export type HeaderChain = {
  /** Check whether given hash is part of the ancestor chain. */
  isInChain(header: HeaderHash): boolean;
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
  /** There is a report pending availability on that core already. */
  CoreEngaged = 7,
  /** Anchor block is not found in recent blocks. */
  AnchorNotRecent = 8,
  /** Service not foubd. */
  BadServiceId = 9,
  /** Service code hash does not match the current one. */
  BadCodeHash = 10,
  /** Pre-requisite work package is missing in either recent blocks or lookup extrinsic. */
  DependencyMissing = 11,
  /** Results for the same package are in more than one report. */
  DuplicatePackage = 12,
  /** Anchor block declared state root does not match the one we have in recent blocks. */
  BadStateRoot = 13,
  /** BEEFY super hash mmr mismatch. */
  BadBeefyMmrRoot = 14,
  /** The authorization hash is not found in the authorization pool. */
  CoreUnauthorized = 15,
  /** Validator index is greater than the number of validators. */
  BadValidatorIndex = 16,
  /** Total gas of work report is too high. */
  WorkReportGasTooHigh = 17,
  /** Work item has is smaller than required minimal accumulation gas of a service. */
  ServiceItemGasTooLow = 18,
  /** The report has too many dependencies (prerequisites and/or segment-root lookups). */
  TooManyDependencies = 19,
  /** Segment root lookup block has invalid time slot or is not found in the header chain. */
  SegmentRootLookupInvalid = 20,
  /** Signature in credentials is invalid. */
  BadSignature = 21,
  /** Size of authorizer output and all work-item successful output blobs is too big. */
  WorkReportTooBig = 22,
}

/**
 * `J = 8`: The maximum sum of dependency items in a work-report.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/416a00416a00?v=0.6.2
 */
const MAX_REPORT_DEPENDENCIES = 8;

/**
 * `W_R = 48 * 2**10`: The maximum total size of all output blobs in a work-report, in octets.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/41a60041aa00?v=0.6.2
 */
const MAX_WORK_REPORT_SIZE_BYTES = 48 * 2 ** 10;

type GuarantorAssignment = {
  core: CoreIndex;
  ed25519: Ed25519Key;
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
    const reportsOrderResult = this.verifyReportsOrder(input.guarantees);
    if (reportsOrderResult.isError) {
      return reportsOrderResult;
    }

    // check some basic reports validity
    const reportsValidity = this.verifyReportsBasic(input.guarantees);
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

    return Result.ok({
      reported: contextualValidity.ok,
      // TODO [ToDr] can there be duplicates?
      reporters: asKnownSize(signaturesToVerify.ok.map((x) => x.key)),
    });
  }

  verifyContextualValidity(input: ReportsInput): Result<WorkPackageInfo[], ReportsError> {
    const contexts: RefineContext[] = [];
    // hashes of work packages reported in this extrinsic
    const currentWorkPackages = new HashDictionary<WorkPackageHash, ExportsRootHash>();
    const prerequisiteHashes = HashSet.new<WorkPackageHash>();
    const segmentRootLookupHashes = HashSet.new<WorkPackageHash>();

    for (const guaranteeView of input.guarantees) {
      const guarantee = guaranteeView.materialize();
      contexts.push(guarantee.report.context);
      currentWorkPackages.set(guarantee.report.workPackageSpec.hash, guarantee.report.workPackageSpec.exportsRoot);
      prerequisiteHashes.insertAll(guarantee.report.context.prerequisites);
      segmentRootLookupHashes.insertAll(guarantee.report.segmentRootLookup.map((x) => x.workPackageHash));

      for (const result of guarantee.report.results) {
        // TODO [ToDr] [opti] We should have a dictionary here rather than do slow lookups.
        const service = this.state.services.find((x) => x.id === result.serviceId);
        if (service === undefined) {
          return Result.error(ReportsError.BadServiceId, `No service with id: ${result.serviceId}`);
        }

        // check service code hash
        // https://graypaper.fluffylabs.dev/#/5f542d7/154b02154b02
        if (!result.codeHash.isEqualTo(service.info.codeHash)) {
          return Result.error(
            ReportsError.BadCodeHash,
            `Service (${result.serviceId}) code hash mismatch. Got: ${result.codeHash}, expected: ${service.info.codeHash}`,
          );
        }
      }
    }

    /**
     * There must be no duplicate work-package hashes (i.e.
     * two work-reports of the same package).
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/151f01152101
     */
    if (currentWorkPackages.size !== input.guarantees.length) {
      return Result.error(ReportsError.DuplicatePackage, "Duplicate work package detected.");
    }

    const minLookupSlot = Math.max(0, input.slot - L);
    const contextResult = this.verifyRefineContexts(minLookupSlot, contexts);
    if (contextResult.isError) {
      return contextResult;
    }

    const uniquenessResult = this.verifyWorkPackagesUniqueness(HashSet.fromDictionary(currentWorkPackages));
    if (uniquenessResult.isError) {
      return uniquenessResult;
    }

    // construct dictionary of recently-reported work packages and their segment roots
    const recentlyReported = new HashDictionary<WorkPackageHash, ExportsRootHash>();
    for (const recentBlock of this.state.recentBlocks) {
      // TODO [ToDr] [opti] we should have a dictionary in the state already
      for (const reported of recentBlock.reported) {
        recentlyReported.set(reported.workPackageHash, reported.segmentTreeRoot);
      }
    }

    // Verify pre-requisites
    const prerequisitesResult = this.verifyDependencies({
      currentWorkPackages,
      recentlyReported,
      // TODO [ToDr] merge the two into `dependencies`?
      prerequisiteHashes,
      segmentRootLookupHashes,
    });
    if (prerequisitesResult.isError) {
      return prerequisitesResult;
    }

    // check that every item in report.segmentRootLookup
    // is matching the mapping in:
    // - either currently work package info
    // - recently reported work package info
    // (i.e. segmentRootLookup needs to be a sub-dictionary)
    for (const gurantee of input.guarantees) {
      const report = gurantee.materialize().report;
      for (const lookup of report.segmentRootLookup) {
        let root = currentWorkPackages.get(lookup.workPackageHash);
        if (root === undefined) {
          root = recentlyReported.get(lookup.workPackageHash);
        }
        if (root === undefined || !root.isEqualTo(lookup.segmentTreeRoot)) {
          return Result.error(
            ReportsError.SegmentRootLookupInvalid,
            `Mismatching segment tree root for package ${lookup.workPackageHash}. Got: ${lookup.segmentTreeRoot}, expected: ${root}`,
          );
        }
      }
    }

    // TODO [ToDr] More efficient into-array serialization?
    const reported: WorkPackageInfo[] = [];
    for (const [key, val] of currentWorkPackages) {
      reported.push(new WorkPackageInfo(key, val));
    }

    return Result.ok(reported);
  }

  verifyDependencies({
    currentWorkPackages,
    recentlyReported,
    prerequisiteHashes,
    segmentRootLookupHashes,
  }: {
    currentWorkPackages: HashDictionary<WorkPackageHash, ExportsRootHash>;
    recentlyReported: HashDictionary<WorkPackageHash, ExportsRootHash>;
    prerequisiteHashes: HashSet<WorkPackageHash>;
    segmentRootLookupHashes: HashSet<WorkPackageHash>;
  }): Result<OK, ReportsError> {
    const checkDependencies = (dependencies: HashSet<WorkPackageHash>): Result<OK, ReportsError> => {
      /**
       * We require that the prerequisite work-packages, if
       * present, and any work-packages mentioned in the
       * segment-root lookup, be either in the extrinsic or in our
       * recent history.
       *
       * https://graypaper.fluffylabs.dev/#/5f542d7/15ca0115cd01
       */
      for (const preReqHash of dependencies) {
        if (currentWorkPackages.has(preReqHash)) {
          continue;
        }

        if (recentlyReported.has(preReqHash)) {
          continue;
        }

        return Result.error(
          ReportsError.DependencyMissing,
          `Missing work package ${preReqHash} in current extrinsic or recent history.`,
        );
      }

      return Result.ok(OK);
    };

    const prerequisitesResult = checkDependencies(prerequisiteHashes);
    if (prerequisitesResult.isError) {
      return prerequisitesResult;
    }
    // TODO: do the same for segmentRootLookupHashes (maybe we don't need separate set?)
    const segmentRootResult = checkDependencies(segmentRootLookupHashes);
    if (segmentRootResult.isError) {
      return segmentRootResult;
    }

    return Result.ok(OK);
  }

  verifyWorkPackagesUniqueness(workPackageHashes: HashSet<WorkPackageHash>): Result<OK, ReportsError> {
    /**
     * Make sure that the package does not appear anywhere in the pipeline.
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/159101159101
     */
    // TODO [ToDr] [opti] this most likely should be cached and either
    // re-computed on invalidity or we could maintain additional
    // structure that's in-sync with the state.
    // For now, for the sake of simplicity, let's compute it every time.
    const packagesInPipeline = HashSet.new();

    // all work packages reported in recent blocks
    for (const recentBlock of this.state.recentBlocks) {
      packagesInPipeline.insertAll(recentBlock.reported.map((x) => x.workPackageHash));
    }

    // all work packages recently accumulated
    for (const hashes of this.state.recentlyAccumulated) {
      packagesInPipeline.insertAll(hashes);
    }

    // all work packages that are in reports, which await accumulation
    for (const pendingAccumulation of this.state.accumulationQueue) {
      packagesInPipeline.insertAll(pendingAccumulation.map((x) => x.report.workPackageSpec.hash));
    }

    // finally all packages from reports with pending availability
    for (const pendingAvailability of this.state.availabilityAssignment) {
      if (pendingAvailability !== null) {
        packagesInPipeline.insert(pendingAvailability.workReport.data.workPackageSpec.hash);
      }
    }

    // let's check if any of our packages is in the pipeline
    const intersection = packagesInPipeline.intersection(workPackageHashes);
    for (const packageHash of intersection) {
      return Result.error(
        ReportsError.DuplicatePackage,
        `The same work package hash found in the pipeline (workPackageHash: ${packageHash})`,
      );
    }

    return Result.ok(OK);
  }

  verifyRefineContexts(minLookupSlot: number, contexts: RefineContext[]): Result<OK, ReportsError> {
    // TODO [ToDr] [opti] This could be cached and updated efficiently between runs.
    const recentBlocks = new HashDictionary<HeaderHash, BlockState>();
    for (const recentBlock of this.state.recentBlocks) {
      recentBlocks.set(recentBlock.headerHash, recentBlock);
    }
    for (const context of contexts) {
      /**
       * We require that the anchor block be within the last H
       * blocks and that its details be correct by ensuring that it
       * appears within our most recent blocks β †:
       *
       * https://graypaper.fluffylabs.dev/#/5f542d7/152801152b01
       */
      const recentBlock = recentBlocks.get(context.anchor);
      if (recentBlock === undefined) {
        return Result.error(ReportsError.AnchorNotRecent, `Anchor block ${context.anchor} not found in recent blocks.`);
      }

      // check state root
      if (!recentBlock.postStateRoot.isEqualTo(context.stateRoot)) {
        return Result.error(
          ReportsError.BadStateRoot,
          `Anchor state root mismatch. Got: ${context.stateRoot}, expected: ${recentBlock.postStateRoot}.`,
        );
      }

      // TODO [ToDr] [opti] Don't calculate super peak hash every time.
      //                    use either some cache or pre-processing.
      // check beefy root
      const mmr = MerkleMountainRange.fromPeaks(this.hasher, recentBlock.mmr);
      const superPeakHash = mmr.getSuperPeakHash();
      if (!superPeakHash.isEqualTo(context.beefyRoot)) {
        return Result.error(
          ReportsError.BadBeefyMmrRoot,
          `Invalid BEEFY super peak hash. Got: ${context.beefyRoot}, expected: ${superPeakHash}. Anchor: ${recentBlock.headerHash}`,
        );
      }

      /**
       * We require that each lookup-anchor block be within the
       * last L timeslots.
       *
       * https://graypaper.fluffylabs.dev/#/5f542d7/154601154701
       */
      if (context.lookupAnchorSlot < minLookupSlot) {
        return Result.error(
          ReportsError.SegmentRootLookupInvalid,
          `Lookup anchor slot's too old. Got: ${context.lookupAnchorSlot}, minimal: ${minLookupSlot}`,
        );
      }

      /**
       * We also require that we have a record of it; this is one of
       * the few conditions which cannot be checked purely with
       * on-chain state and must be checked by virtue of retaini
       * ing the series of the last L headers as the ancestor set A.
       *
       * https://graypaper.fluffylabs.dev/#/5f542d7/155c01155f01
       */
      if (!this.headerChain.isInChain(context.lookupAnchor)) {
        return Result.error(
          ReportsError.SegmentRootLookupInvalid,
          `Lookup anchor is not found in chain. Hash: ${context.lookupAnchor} (slot: ${context.lookupAnchorSlot})`,
        );
      }
    }

    return Result.ok(OK);
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

  verifyPostSignatureChecks(input: GuaranteesExtrinsicView): Result<OK, ReportsError> {
    for (const guaranteeView of input) {
      const guarantee = guaranteeView.materialize();
      const report = guarantee.report;
      const coreIndex = report.coreIndex;
      /**
       * No reports may be placed on cores with a report pending
       * availability on it.
       *
       * https://graypaper.fluffylabs.dev/#/5f542d7/15ea0015ea00
       */
      if (this.state.availabilityAssignment[coreIndex] !== null) {
        return Result.error(ReportsError.CoreEngaged, `Report pending availability at core: ${coreIndex}`);
      }

      /**
       * A report is valid only if the authorizer hash is present
       * in the authorizer pool of the core on which the work is
       * reported.
       *
       * https://graypaper.fluffylabs.dev/#/5f542d7/15eb0015ed00
       */
      const authorizerHash = report.authorizerHash;
      const authorizerPool = this.state.authPools[coreIndex];
      // TODO [ToDr] [opti] We should have a dictionary here rather than do slow lookups.
      if (!authorizerPool.find((hash) => hash.isEqualTo(authorizerHash))) {
        return Result.error(
          ReportsError.CoreUnauthorized,
          `Authorizer hash not found in the pool of core ${coreIndex}: ${authorizerHash}`,
        );
      }

      // TODO [ToDr] shall we agregate items data before checking?
      // We could first build a map of `serviceId -> minItemGas, codehash`
      // and then check it only once.

      /**
       * We require that the gas allotted for accumulation of each
       * work item in each work-report respects its service’s
       * minimum gas requirements.
       *
       * https://graypaper.fluffylabs.dev/#/5f542d7/15f80015fa00
       */
      for (const result of report.results) {
        // TODO [ToDr] [opti] We should have a dictionary here rather than do slow lookups.
        const service = this.state.services.find((x) => x.id === result.serviceId);
        if (service === undefined) {
          return Result.error(ReportsError.BadServiceId, `No service with id: ${result.serviceId}`);
        }

        // check minimal accumulation gas
        if (result.gas < service.info.accumulateMinGas) {
          return Result.error(
            ReportsError.ServiceItemGasTooLow,
            `Service (${result.serviceId}) gas is less than minimal. Got: ${result.gas}, expected at least: ${service.info.accumulateMinGas}`,
          );
        }
      }

      const totalGas = sumU64(...report.results.map((x) => x.gas));
      if (totalGas.overflow || totalGas.value > G_A) {
        return Result.error(
          ReportsError.WorkReportGasTooHigh,
          `Total gas too high. Got: ${totalGas.value} (ovfl: ${totalGas.overflow}), maximal: ${G_A}`,
        );
      }
    }

    return Result.ok(OK);
  }

  verifyReportsBasic(input: GuaranteesExtrinsicView): Result<OK, ReportsError> {
    for (const guarantee of input) {
      const reportView = guarantee.view().report.view();
      /**
       * We limit the sum of the number of items in the
       * segment-root lookup dictionary and the number of
       * prerequisites to J = 8:
       */
      const noOfPrerequisites = reportView.context.view().prerequisites.view().length;
      const noOfSegmentRootLookups = reportView.segmentRootLookup.view().length;
      if (noOfPrerequisites + noOfSegmentRootLookups > MAX_REPORT_DEPENDENCIES) {
        return Result.error(
          ReportsError.TooManyDependencies,
          `Report at ${reportView.coreIndex.encoded()} has too many depdencies. Got ${noOfPrerequisites} + ${noOfSegmentRootLookups}, max: ${MAX_REPORT_DEPENDENCIES}`,
        );
      }

      /**
       * In order to ensure fair use of a block’s extrinsic space,
       * work-reports are limited in the maximum total size of the
       * successful output blobs together with the authorizer output
       * blob, effectively limiting their overall size:
       *
       * https://graypaper.fluffylabs.dev/#/5f542d7/141d00142000?v=0.6.2
       */
      // adding is safe here, since the total-encoded size of the report
      // is limited as well. Even though we just have a view, the size
      // should have been verified earlier.
      const authOutputSize = reportView.authorizationOutput.view().length;
      let totalOutputsSize = 0;
      for (const item of reportView.results.view()) {
        totalOutputsSize += item.view().result.view().okBlob?.raw.length ?? 0;
      }
      if (authOutputSize + totalOutputsSize > MAX_WORK_REPORT_SIZE_BYTES) {
        return Result.error(
          ReportsError.WorkReportTooBig,
          `Work report at ${reportView.coreIndex.encoded()} too big. Got ${authOutputSize} + ${totalOutputsSize}, max: ${MAX_WORK_REPORT_SIZE_BYTES}`,
        );
      }
    }

    return Result.ok(OK);
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
      console.log(guarantorAssignments.map((x) => `${x.ed25519} -> ${x.core}`));

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
