import {
  BANDERSNATCH_KEY_BYTES,
  BLS_KEY_BYTES,
  type BandersnatchKey,
  type BlsKey,
  ED25519_KEY_BYTES,
  type Ed25519Key,
} from "@typeberry/block/crypto";
import type { Bytes } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import { WithDebug } from "@typeberry/utils";

/**
 * Fixed size of validator metadata.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/0d55010d5501
 */
export const VALIDATOR_META_BYTES = 128;
export type VALIDATOR_META_BYTES = typeof VALIDATOR_META_BYTES;

/**
 * Details about validators' identity.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/0d4b010d4c01
 */
export class ValidatorData extends WithDebug {
  static Codec = codec.Class(ValidatorData, {
    bandersnatch: codec.bytes(BANDERSNATCH_KEY_BYTES).asOpaque(),
    ed25519: codec.bytes(ED25519_KEY_BYTES).asOpaque(),
    bls: codec.bytes(BLS_KEY_BYTES).asOpaque(),
    metadata: codec.bytes(VALIDATOR_META_BYTES),
  });

  static fromCodec({ ed25519, bandersnatch, bls, metadata }: CodecRecord<ValidatorData>) {
    return new ValidatorData(bandersnatch, ed25519, bls, metadata);
  }

  constructor(
    /** Bandersnatch public key. */
    public readonly bandersnatch: BandersnatchKey,
    /** ED25519 key data. */
    public readonly ed25519: Ed25519Key,
    /** BLS public key. */
    public readonly bls: BlsKey,
    /** Validator-defined additional metdata. */
    public readonly metadata: Bytes<VALIDATOR_META_BYTES>,
  ) {
    super();
  }
}
