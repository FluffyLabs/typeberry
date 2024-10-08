import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { U32 } from "@typeberry/numbers";
import type { Opaque } from "@typeberry/utils";

// TODO [ToDr] Find good place
export type ServiceId = Opaque<U32, "ServiceId[u32]">;

export class Preimage {
  static Codec = codec.Class(Preimage, {
    requester: codec.u32.cast(),
    blob: codec.blob,
  });
  static fromCodec({ requester, blob }: CodecRecord<Preimage>) {
    return new Preimage(requester, blob);
  }

  constructor(
    public readonly requester: ServiceId,
    public readonly blob: BytesBlob,
  ) {}
}

export type PreimagesExtrinsic = Preimage[];
export const preimagesExtrinsicCodec = codec.sequenceVarLen(Preimage.Codec);
