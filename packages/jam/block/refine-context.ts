import { type CodecRecord, codec } from "@typeberry/codec";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { type Opaque, WithDebug } from "@typeberry/utils";
import type { StateRootHash, TimeSlot } from "./common.js";
import type { HeaderHash } from "./hash.js";

/**
 * Keccak-256 hash of the BEEFY MMR root.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/1e4f011e5201
 */
export type BeefyHash = Opaque<OpaqueHash, "BeefyHash">;

/** Authorizer hash. */
export type AuthorizerHash = Opaque<OpaqueHash, "AuthorizerHash">;

/** Blake2B hash of a work package. */
export type WorkPackageHash = Opaque<OpaqueHash, "WorkPackageHash">;

/** Work package exported segments merkle root hash. */
export type ExportsRootHash = Opaque<OpaqueHash, "ExportsRootHash">;

/**
 * Mapping between work package hash and root hash of it's exports.
 *
 * Used to construct a dictionary.
 */
export class WorkPackageInfo extends WithDebug {
  static Codec = codec.Class(WorkPackageInfo, {
    workPackageHash: codec.bytes(HASH_SIZE).asOpaque<WorkPackageHash>(),
    segmentTreeRoot: codec.bytes(HASH_SIZE).asOpaque<ExportsRootHash>(),
  });

  private constructor(
    /** Hash of the described work package. */
    readonly workPackageHash: WorkPackageHash,
    /** Exports root hash. */
    readonly segmentTreeRoot: ExportsRootHash,
  ) {
    super();
  }

  static create({ workPackageHash, segmentTreeRoot }: CodecRecord<WorkPackageInfo>) {
    return new WorkPackageInfo(workPackageHash, segmentTreeRoot);
  }
}
/**
 * `X`: Refinement Context - state of the chain at the point
 * that the report's corresponding work-package was evaluated.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/13b80013bb00
 */
export class RefineContext extends WithDebug {
  static Codec = codec.Class(RefineContext, {
    anchor: codec.bytes(HASH_SIZE).asOpaque<HeaderHash>(),
    stateRoot: codec.bytes(HASH_SIZE).asOpaque<StateRootHash>(),
    beefyRoot: codec.bytes(HASH_SIZE).asOpaque<BeefyHash>(),
    lookupAnchor: codec.bytes(HASH_SIZE).asOpaque<HeaderHash>(),
    lookupAnchorSlot: codec.u32.asOpaque<TimeSlot>(),
    prerequisites: codec.sequenceVarLen(codec.bytes(HASH_SIZE).asOpaque<WorkPackageHash>()),
  });

  static create({
    anchor,
    stateRoot,
    beefyRoot,
    lookupAnchor,
    lookupAnchorSlot,
    prerequisites,
  }: CodecRecord<RefineContext>) {
    return new RefineContext(anchor, stateRoot, beefyRoot, lookupAnchor, lookupAnchorSlot, prerequisites);
  }

  private constructor(
    /** `a`: Header hash at which the work-package was evaluated. */
    public readonly anchor: HeaderHash,
    /** `s`: **Posterior** state root of the anchor. */
    public readonly stateRoot: StateRootHash,
    /** `b`: **Posterior** BEEFY root. */
    public readonly beefyRoot: BeefyHash,
    /** `l`: Preimage lookup anchor. */
    public readonly lookupAnchor: HeaderHash,
    /** `t`: Lookup anchor time slot. */
    public readonly lookupAnchorSlot: TimeSlot,
    /** `p`: List of hashes of the prerequisite work-packages. */
    public readonly prerequisites: WorkPackageHash[] = [],
  ) {
    super();
  }
}
