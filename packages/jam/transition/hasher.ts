import { Extrinsic, type ExtrinsicHash, type HeaderHash, type HeaderView } from "@typeberry/block";
import { WorkPackage } from "@typeberry/block/work-package";
import type { WorkPackageHash } from "@typeberry/block/work-report";
import type { BytesBlob } from "@typeberry/bytes";
import { type Codec, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import {
  type HashAllocator,
  type KeccakHash,
  type OpaqueHash,
  WithHash,
  WithHashAndBytes,
  blake2b,
  keccak,
} from "@typeberry/hash";
import type { MmrHasher } from "@typeberry/mmr";

export class TransitionHasher implements MmrHasher<KeccakHash> {
  constructor(
    private readonly context: ChainSpec,
    private readonly keccakHasher: keccak.KeccakHasher,
    private readonly allocator: HashAllocator,
  ) {}

  hashConcat(a: KeccakHash, b: KeccakHash): KeccakHash {
    return keccak.hashBlobs(this.keccakHasher, [a, b]);
  }
  hashConcatPrepend(id: BytesBlob, a: KeccakHash, b: KeccakHash): KeccakHash {
    return keccak.hashBlobs(this.keccakHasher, [id, a, b]);
  }

  header(header: HeaderView): WithHash<HeaderHash, HeaderView> {
    return new WithHash(blake2b.hashBytes(header.encoded(), this.allocator).asOpaque(), header);
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
