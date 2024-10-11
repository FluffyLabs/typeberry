import type { BitVec } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import type { ValidatorIndex } from "./common";
import { ChainSpec, EST_CORES } from "./context";
import { ED25519_SIGNATURE_BYTES, type Ed25519Signature } from "./crypto";
import { HASH_SIZE, type HeaderHash } from "./hash";

export class AvailabilityAssurance {
  static Codec = codec.Class(AvailabilityAssurance, {
    anchor: codec.bytes(HASH_SIZE).cast(),
    bitfield: codec.select(
      {
        name: "AvailabilityAssurance.bitfield",
        sizeHintBytes: Math.ceil(EST_CORES / 8),
      },
      (context) => {
        if (context instanceof ChainSpec) {
          return codec.bitVecFixLen(Math.ceil(context.coresCount / 8) * 8);
        }
        throw new Error("Missing context object to decode `AvailabilityAssurance.bitfield`.");
      },
    ),
    validatorIndex: codec.u16.cast(),
    signature: codec.bytes(ED25519_SIGNATURE_BYTES).cast(),
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
export const assurancesExtrinsicCodec = codec.sequenceVarLen(AvailabilityAssurance.Codec).cast<AssurancesExtrinsic>();
