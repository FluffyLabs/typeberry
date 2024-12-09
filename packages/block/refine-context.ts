import { type CodecRecord, codec } from "@typeberry/codec";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import type { TrieHash } from "@typeberry/trie";
import { type Opaque, WithDebug } from "@typeberry/utils";
import type { TimeSlot } from "./common";
import type { HeaderHash } from "./hash";

/**
 * Keccak-256 hash of the BEEFY MMR root.
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/1e76001e7900
 */
export type BeefyHash = Opaque<OpaqueHash, "BeefyHash">;

/**
 * `X`: Refinement Context - state of the chain at the point
 * that the report's corresponding work-package was evaluated.
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/138600138900
 */
export class RefineContext extends WithDebug {
  static Codec = codec.Class(RefineContext, {
    anchor: codec.bytes(HASH_SIZE).asOpaque(),
    stateRoot: codec.bytes(HASH_SIZE).asOpaque(),
    beefyRoot: codec.bytes(HASH_SIZE).asOpaque(),
    lookupAnchor: codec.bytes(HASH_SIZE).asOpaque(),
    lookupAnchorSlot: codec.u32.asOpaque(),
    prerequisites: codec.sequenceVarLen(codec.bytes(HASH_SIZE)),
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
    public readonly stateRoot: TrieHash,
    /** `b`: **Posterior** BEEFY root. */
    public readonly beefyRoot: BeefyHash,
    /** `l`: Preimage lookup anchor. */
    public readonly lookupAnchor: HeaderHash,
    /** `t`: Lookup anchor time slot. */
    public readonly lookupAnchorSlot: TimeSlot,
    /** `p`: Optional hash of the prerequisite work-package. */
    public readonly prerequisites: OpaqueHash[] = [],
  ) {
    super();
  }
}
