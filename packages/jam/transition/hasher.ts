import { Extrinsic, type ExtrinsicHash, Header, type HeaderHash, type HeaderView } from "@typeberry/block";
import { WorkPackage } from "@typeberry/block/work-package";
import type { WorkPackageHash } from "@typeberry/block/work-report";
import { type Codec, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { type HashAllocator, type OpaqueHash, WithHashAndBytes, blake2b } from "@typeberry/hash";

export class TransitionHasher {
  constructor(
    private readonly context: ChainSpec,
    private readonly allocator: HashAllocator,
  ) {}

  header(header: HeaderView): WithHashAndBytes<HeaderHash, HeaderView> {
    return this.encode(Header.Codec.View, header);
  }

  extrinsic(extrinsic: Extrinsic): WithHashAndBytes<ExtrinsicHash, Extrinsic> {
    // TODO [ToDr] This is incorrect, since extrinc hash should be a merkle root.
    return this.encode(Extrinsic.Codec, extrinsic);
  }

  workPackage(workPackage: WorkPackage): WithHashAndBytes<WorkPackageHash, WorkPackage> {
    return this.encode(WorkPackage.Codec, workPackage);
  }

  private encode<T, THash extends OpaqueHash>(codec: Codec<T>, data: T): WithHashAndBytes<THash, T> {
    // TODO [ToDr] Use already allocated encoding destination and hash bytes from some arena.
    const encoded = Encoder.encodeObject(codec, data, this.context);
    return new WithHashAndBytes(blake2b.hashBytes(encoded, this.allocator).asOpaque(), data, encoded);
  }
}
