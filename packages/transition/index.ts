import { Extrinsic, type ExtrinsicHash, Header, type HeaderHash, WithHash } from "@typeberry/block";
import type { ChainSpec } from "@typeberry/block/context";
import { Encoder } from "@typeberry/codec";
import { type HashAllocator, hashBytes } from "@typeberry/hash";

export class TransitionHasher {
  constructor(
    private readonly context: ChainSpec,
    private readonly allocator: HashAllocator,
  ) {}

  header(header: Header): WithHash<HeaderHash, Header> {
    // TODO [ToDr] Use already allocated encoding destination and hash bytes from some arena.
    const encoded = Encoder.encodeObject(Header.Codec, header, this.context);
    return new WithHash(hashBytes(encoded, this.allocator) as HeaderHash, header);
  }

  extrinsic(extrinsic: Extrinsic): WithHash<ExtrinsicHash, Extrinsic> {
    // TODO [ToDr] Use already allocated encoding destination and hash bytes from some arena.
    const encoded = Encoder.encodeObject(Extrinsic.Codec, extrinsic, this.context);
    return new WithHash(hashBytes(encoded, this.allocator) as ExtrinsicHash, extrinsic);
  }
}
