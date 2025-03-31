import { type CodecRecord, codec } from "@typeberry/codec";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { type Opaque, WithDebug } from "@typeberry/utils";
import type { StateRootHash, TimeSlot } from "./common";
import type { HeaderHash } from "./hash";
import type { WorkPackageHash } from "./work-report";

/**
 * Keccak-256 hash of the BEEFY MMR root.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/1e4f011e5201
 */
export type BeefyHash = Opaque<OpaqueHash, "BeefyHash">;

/** Program Counter */
export type ProgramCounter = Opaque<OpaqueHash, "ProgramCounter[u64]">;

/**
 * `X`: Refinement Context - state of the chain at the point
 * that the report's corresponding work-package was evaluated.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/13b80013bb00
 */
export class RefineContext extends WithDebug {
  static Codec = codec.Class(RefineContext, {
    anchor: codec.bytes(HASH_SIZE).asOpaque(),
    stateRoot: codec.bytes(HASH_SIZE).asOpaque(),
    beefyRoot: codec.bytes(HASH_SIZE).asOpaque(),
    lookupAnchor: codec.bytes(HASH_SIZE).asOpaque(),
    lookupAnchorSlot: codec.u32.asOpaque(),
    prerequisites: codec.sequenceVarLen(codec.bytes(HASH_SIZE).asOpaque()),
  });

  static fromCodec({
    anchor,
    stateRoot,
    beefyRoot,
    lookupAnchor,
    lookupAnchorSlot,
    prerequisites,
  }: CodecRecord<RefineContext>) {
    return new RefineContext(anchor, stateRoot, beefyRoot, lookupAnchor, lookupAnchorSlot, prerequisites);
  }

  constructor(
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
