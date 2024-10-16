import { Extrinsic, type ExtrinsicHash, Header, type HeaderHash } from "@typeberry/block";
import type { ChainSpec } from "@typeberry/block/context";
import { Encoder } from "@typeberry/codec";
import { type HashAllocator, hashBytes } from "@typeberry/hash";

export class TransitionHasher {
  constructor(
    private readonly context: ChainSpec,
    private readonly allocator: HashAllocator,
  ) {}

  header(header: Header): HeaderHash {
    // TODO [ToDr] Use already allocated encoding destination and hash bytes from some arena.
    const encoded = Encoder.encodeObject(Header.Codec, header, this.context);
    return hashBytes(encoded, this.allocator) as HeaderHash;
  }

  extrinsic(extrinsic: Extrinsic): ExtrinsicHash {
    // TODO [ToDr] Use already allocated encoding destination and hash bytes from some arena.
    const encoded = Encoder.encodeObject(Extrinsic.Codec, extrinsic, this.context);
    return hashBytes(encoded, this.allocator) as ExtrinsicHash;
  }
}
