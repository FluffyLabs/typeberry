import type { HeaderHash, TimeSlot } from "@typeberry/block";
import type { GuaranteesExtrinsicView } from "@typeberry/block/guarantees";
import type { RefineContext } from "@typeberry/block/refine-context";
import { type ExportsRootHash, type WorkPackageHash, WorkPackageInfo } from "@typeberry/block/work-report";
import { bytesBlobComparator } from "@typeberry/bytes";
import { HashDictionary, SortedSet } from "@typeberry/collections";
import { HashSet } from "@typeberry/collections/hash-set";
import type { KeccakHash } from "@typeberry/hash";
import { MerkleMountainRange, type MmrHasher } from "@typeberry/mmr";
import type { BlockState, State } from "@typeberry/state";
import { OK, Result } from "@typeberry/utils";
import { ReportsError } from "./error";

/** `L`: The maximum age in timeslots of the lookup anchor. */
export const L = 14_400;

/** Recently imported blocks. */
export type HeaderChain = {
  /** Check whether given hash is part of the ancestor chain. */
  isInChain(header: HeaderHash): boolean;
};

export function verifyContextualValidity(
  input: { guarantees: GuaranteesExtrinsicView; slot: TimeSlot },
  state: Pick<
    State,
    "services" | "recentBlocks" | "availabilityAssignment" | "accumulationQueue" | "recentlyAccumulated"
  >,
  hasher: MmrHasher<KeccakHash>,
  headerChain: HeaderChain,
): Result<WorkPackageInfo[], ReportsError> {
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
      const service = state.services.find((x) => x.id === result.serviceId);
      if (service === undefined) {
        return Result.error(ReportsError.BadServiceId, `No service with id: ${result.serviceId}`);
      }

      // check service code hash
      // https://graypaper.fluffylabs.dev/#/5f542d7/154b02154b02
      if (!result.codeHash.isEqualTo(service.data.service.codeHash)) {
        return Result.error(
          ReportsError.BadCodeHash,
          `Service (${result.serviceId}) code hash mismatch. Got: ${result.codeHash}, expected: ${service.data.service.codeHash}`,
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
  const contextResult = verifyRefineContexts(minLookupSlot, contexts, state, hasher, headerChain);
  if (contextResult.isError) {
    return contextResult;
  }

  const uniquenessResult = verifyWorkPackagesUniqueness(HashSet.fromDictionary(currentWorkPackages), state);
  if (uniquenessResult.isError) {
    return uniquenessResult;
  }

  // construct dictionary of recently-reported work packages and their segment roots
  const recentlyReported = new HashDictionary<WorkPackageHash, ExportsRootHash>();
  for (const recentBlock of state.recentBlocks) {
    // TODO [ToDr] [opti] we should have a dictionary in the state already
    for (const reported of recentBlock.reported) {
      recentlyReported.set(reported.workPackageHash, reported.segmentTreeRoot);
    }
  }

  // Verify pre-requisites
  const prerequisitesResult = verifyDependencies({
    currentWorkPackages,
    recentlyReported,
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

  // TODO [ToDr] [opti] More efficient into-array serialization?
  const sortedWorkPackages = SortedSet.fromArray((x, y) => {
    return bytesBlobComparator(x[0], y[0]);
  }, Array.from(currentWorkPackages));

  return Result.ok(sortedWorkPackages.slice().map(([key, val]) => new WorkPackageInfo(key, val)));
}

function verifyRefineContexts(
  minLookupSlot: number,
  contexts: RefineContext[],
  state: Pick<State, "recentBlocks">,
  hasher: MmrHasher<KeccakHash>,
  headerChain: HeaderChain,
): Result<OK, ReportsError> {
  // TODO [ToDr] [opti] This could be cached and updated efficiently between runs.
  const recentBlocks = new HashDictionary<HeaderHash, BlockState>();
  for (const recentBlock of state.recentBlocks) {
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
    const mmr = MerkleMountainRange.fromPeaks(hasher, recentBlock.mmr);
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
    if (!headerChain.isInChain(context.lookupAnchor)) {
      return Result.error(
        ReportsError.SegmentRootLookupInvalid,
        `Lookup anchor is not found in chain. Hash: ${context.lookupAnchor} (slot: ${context.lookupAnchorSlot})`,
      );
    }
  }

  return Result.ok(OK);
}

function verifyDependencies({
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
  const checkDependencies = (
    dependencies: HashSet<WorkPackageHash>,
    isSegmentRoot = false,
  ): Result<OK, ReportsError> => {
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
        isSegmentRoot ? ReportsError.SegmentRootLookupInvalid : ReportsError.DependencyMissing,
        `Missing work package ${preReqHash} in current extrinsic or recent history.`,
      );
    }

    return Result.ok(OK);
  };

  const prerequisitesResult = checkDependencies(prerequisiteHashes);
  if (prerequisitesResult.isError) {
    return prerequisitesResult;
  }
  // do the same for segmentRootLookupHashes, we need a different set
  // to return a different error for JAM test vectors.
  const segmentRootResult = checkDependencies(segmentRootLookupHashes, true);
  if (segmentRootResult.isError) {
    return segmentRootResult;
  }

  return Result.ok(OK);
}

function verifyWorkPackagesUniqueness(
  workPackageHashes: HashSet<WorkPackageHash>,
  state: Pick<State, "recentBlocks" | "recentlyAccumulated" | "accumulationQueue" | "availabilityAssignment">,
): Result<OK, ReportsError> {
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
  for (const recentBlock of state.recentBlocks) {
    packagesInPipeline.insertAll(recentBlock.reported.map((x) => x.workPackageHash));
  }

  // all work packages recently accumulated
  for (const hashes of state.recentlyAccumulated) {
    packagesInPipeline.insertAll(hashes);
  }

  // all work packages that are in reports, which await accumulation
  for (const pendingAccumulation of state.accumulationQueue) {
    packagesInPipeline.insertAll(pendingAccumulation.map((x) => x.report.workPackageSpec.hash));
  }

  // finally all packages from reports with pending availability
  for (const pendingAvailability of state.availabilityAssignment) {
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
