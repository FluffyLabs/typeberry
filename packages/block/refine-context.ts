import { type CodecRecord, codec } from "@typeberry/codec";
import type { Bytes, TrieHash } from "@typeberry/trie";
import type { Opaque } from "@typeberry/utils";
import type { TimeSlot } from "./common";
import { HASH_SIZE, type HeaderHash } from "./hash";

/**
 * Keccak-256 hash of the BEEFY MMR root.
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/1e76001e7900
 */
export type BeefyHash = Opaque<Bytes<typeof HASH_SIZE>, "BeefyHash">;

export class RefineContext {
  static Codec = codec.Class(RefineContext, {
    anchor: codec.bytes(HASH_SIZE).cast(),
    stateRoot: codec.bytes(HASH_SIZE).cast(),
    beefyRoot: codec.bytes(HASH_SIZE).cast(),
    lookupAnchor: codec.bytes(HASH_SIZE).cast(),
    lookupAnchorSlot: codec.u32.cast(),
    prerequisite: codec.optional(codec.bytes(HASH_SIZE)),
  });

  static fromCodec({
    anchor,
    stateRoot,
    beefyRoot,
    lookupAnchor,
    lookupAnchorSlot,
    prerequisite,
  }: CodecRecord<RefineContext>) {
    return new RefineContext(anchor, stateRoot, beefyRoot, lookupAnchor, lookupAnchorSlot, prerequisite);
  }

  constructor(
    public readonly anchor: HeaderHash,
    public readonly stateRoot: TrieHash,
    public readonly beefyRoot: BeefyHash,
    public readonly lookupAnchor: HeaderHash,
    public readonly lookupAnchorSlot: TimeSlot,
    public readonly prerequisite: Bytes<typeof HASH_SIZE> | null = null,
  ) {}
}
