import type { Bytes } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import { WithDebug } from "@typeberry/utils";
import {
  BANDERSNATCH_KEY_BYTES,
  BLS_KEY_BYTES,
  type BandersnatchKey,
  type BlsKey,
  ED25519_KEY_BYTES,
  type Ed25519Key,
} from "./crypto";

export const VALIDATOR_META_BYTES = 128;
export type VALIDATOR_META_BYTES = typeof VALIDATOR_META_BYTES;

export class ValidatorData extends WithDebug {
  static Codec = codec.Class(ValidatorData, {
    ed25519: codec.bytes(ED25519_KEY_BYTES).cast(),
    bandersnatch: codec.bytes(BANDERSNATCH_KEY_BYTES).cast(),
    bls: codec.bytes(BLS_KEY_BYTES).cast(),
    metadata: codec.bytes(VALIDATOR_META_BYTES),
  });

  static fromCodec({ ed25519, bandersnatch, bls, metadata }: CodecRecord<ValidatorData>) {
    return new ValidatorData(ed25519, bandersnatch, bls, metadata);
  }

  constructor(
    public readonly ed25519: Ed25519Key,
    public readonly bandersnatch: BandersnatchKey,
    public readonly bls: BlsKey,
    public readonly metadata: Bytes<VALIDATOR_META_BYTES>,
  ) {
    super();
  }
}
