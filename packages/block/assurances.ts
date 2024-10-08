import type { BitVec } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import type { Ed25519Signature } from "./crypto";
import { HASH_SIZE, type HeaderHash } from "./hash";
import type { ValidatorIndex } from "./header";

export class AvailabilityAssurance {
  static Codec = codec.Class(AvailabilityAssurance, {
    anchor: codec.bytes(HASH_SIZE).cast(),
    // TODO [ToDr] unsure about 8?
    bitfield: codec.bitVecFixLen(8),
    validatorIndex: codec.u16.cast(),
    signature: codec.bytes(64).cast(),
  });

  static fromCodec({ anchor, bitfield, validatorIndex, signature }: CodecRecord<AvailabilityAssurance>) {
    return new AvailabilityAssurance(anchor, bitfield, validatorIndex, signature);
  }

  constructor(
    public readonly anchor: HeaderHash,
    public readonly bitfield: BitVec,
    public readonly validatorIndex: ValidatorIndex,
    public readonly signature: Ed25519Signature,
  ) {}
}

export type AssurancesExtrinsic = KnownSizeArray<AvailabilityAssurance, "0 .. ValidatorsCount">;
export const assurancesExtrinsicCodec = codec.sequenceVarLen(AvailabilityAssurance.Codec);
