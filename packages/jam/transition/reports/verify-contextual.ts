import type { HeaderHash, StateRootHash } from "@typeberry/block";
import type { RefineContext } from "@typeberry/block/refine-context.js";
import { type ExportsRootHash, type WorkPackageHash, WorkPackageInfo } from "@typeberry/block/work-report.js";
import { Bytes } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { HashSet } from "@typeberry/collections/hash-set.js";
import { HASH_SIZE, type KeccakHash } from "@typeberry/hash";
import { MerkleMountainRange, type MmrHasher } from "@typeberry/mmr";
import type { BlockState, State } from "@typeberry/state";
import { OK, Result } from "@typeberry/utils";
import { ReportsError } from "./error.js";
import type { ReportsInput } from "./reports.js";

/** `L`: The maximum age in timeslots of the lookup anchor. */
export const L = 14_400;

/** Recently imported blocks. */
export type HeaderChain = {
  /** Check whether given hash is part of the ancestor chain. */
  isInChain(header: HeaderHash): boolean;
};

export function verifyContextualValidity(
  input: ReportsInput,
  state: Pick<
    State,
    "getService" | "recentBlocks" | "availabilityAssignment" | "accumulationQueue" | "recentlyAccumulated"
  >,
  hasher: MmrHasher<KeccakHash>,
  headerChain: HeaderChain,
): Result<HashDictionary<WorkPackageHash, WorkPackageInfo>, ReportsError> {
  const contexts: RefineContext[] = [];
  // hashes of work packages reported in this extrinsic
  const currentWorkPackages = HashDictionary.new<WorkPackageHash, WorkPackageInfo>();
  const prerequisiteHashes = HashSet.new<WorkPackageHash>();
  const segmentRootLookupHashes = HashSet.new<WorkPackageHash>();

  for (const guaranteeView of input.guarantees) {
    const guarantee = guaranteeView.materialize();
    contexts.push(guarantee.report.context);
    const info = WorkPackageInfo.create({
      workPackageHash: guarantee.report.workPackageSpec.hash,
      segmentTreeRoot: guarantee.report.workPackageSpec.exportsRoot,
    });
    currentWorkPackages.set(info.workPackageHash, info);
    prerequisiteHashes.insertAll(guarantee.report.context.prerequisites);
    segmentRootLookupHashes.insertAll(guarantee.report.segmentRootLookup.map((x) => x.workPackageHash));

    for (const result of guarantee.report.results) {
      const service = state.getService(result.serviceId);
      if (service === null) {
        return Result.error(ReportsError.BadServiceId, `No service with id: ${result.serviceId}`);
      }

      // check service code hash
      // https://graypaper.fluffylabs.dev/#/5f542d7/154b02154b02
      if (!result.codeHash.isEqualTo(service.getInfo().codeHash)) {
        return Result.error(
          ReportsError.BadCodeHash,
          `Service (${result.serviceId}) code hash mismatch. Got: ${result.codeHash}, expected: ${service.getInfo().codeHash}`,
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
  const contextResult = verifyRefineContexts(minLookupSlot, contexts, state, hasher, headerChain, input.priorStateRoot);
  if (contextResult.isError) {
    return contextResult;
  }

  const uniquenessResult = verifyWorkPackagesUniqueness(HashSet.viewDictionaryKeys(currentWorkPackages), state);
  if (uniquenessResult.isError) {
    return uniquenessResult;
  }

  // construct dictionary of recently-reported work packages and their segment roots
  const recentlyReported = HashDictionary.new<WorkPackageHash, ExportsRootHash>();
  for (const recentBlock of state.recentBlocks) {
    for (const reported of recentBlock.reported.values()) {
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
        const exportsRoot = recentlyReported.get(lookup.workPackageHash);
        root =
          exportsRoot !== undefined
            ? WorkPackageInfo.create({ workPackageHash: lookup.workPackageHash, segmentTreeRoot: exportsRoot })
            : undefined;
      }
      if (root === undefined || !root.segmentTreeRoot.isEqualTo(lookup.segmentTreeRoot)) {
        return Result.error(
          ReportsError.SegmentRootLookupInvalid,
          `Mismatching segment tree root for package ${lookup.workPackageHash}. Got: ${lookup.segmentTreeRoot}, expected: ${root?.segmentTreeRoot}`,
        );
      }
    }
  }

  return Result.ok(currentWorkPackages);
}

function verifyRefineContexts(
  minLookupSlot: number,
  contexts: RefineContext[],
  state: Pick<State, "recentBlocks">,
  hasher: MmrHasher<KeccakHash>,
  headerChain: HeaderChain,
  priorStateRoot: StateRootHash,
): Result<OK, ReportsError> {
  // TODO [ToDr] [opti] This could be cached and updated efficiently between runs.
  const recentBlocks = HashDictionary.new<HeaderHash, BlockState>();
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
    const expectedStateRoot = recentBlock.postStateRoot.isEqualTo(Bytes.zero(HASH_SIZE).asOpaque())
      ? priorStateRoot
      : recentBlock.postStateRoot;

    if (!expectedStateRoot.isEqualTo(context.stateRoot)) {
      return Result.error(
        ReportsError.BadStateRoot,
        `Anchor state root mismatch. Got: ${context.stateRoot}, expected: ${expectedStateRoot}.`,
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
  currentWorkPackages: HashDictionary<WorkPackageHash, WorkPackageInfo>;
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
    packagesInPipeline.insertAll(Array.from(recentBlock.reported.keys()));
  }

  // all work packages recently accumulated
  for (const hashes of state.recentlyAccumulated) {
    packagesInPipeline.insertAll(Array.from(hashes));
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
