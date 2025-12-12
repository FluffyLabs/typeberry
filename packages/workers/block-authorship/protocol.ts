import { Block } from "@typeberry/block";
import { type CodecRecord, codec } from "@typeberry/codec";
import {
  BANDERSNATCH_KEY_BYTES,
  type BandersnatchSecretSeed,
  ED25519_KEY_BYTES,
  type Ed25519SecretSeed,
} from "@typeberry/crypto";
import { type Api, createProtocol, type Internal } from "@typeberry/workers-api";

export type GeneratorInternal = Internal<typeof protocol>;
export type GeneratorApi = Api<typeof protocol>;

export const protocol = createProtocol("block-authorship", {
  toWorker: {
    finish: {
      request: codec.nothing,
      response: codec.nothing,
    },
  },
  fromWorker: {
    block: {
      request: Block.Codec.View,
      response: codec.nothing,
    },
  },
});

export class ValidatorSecrets {
  static Codec = codec.Class(ValidatorSecrets, {
    bandersnatch: codec.bytes(BANDERSNATCH_KEY_BYTES).asOpaque<BandersnatchSecretSeed>(),
    ed25519: codec.bytes(ED25519_KEY_BYTES).asOpaque<Ed25519SecretSeed>(),
  });

  static create({ bandersnatch, ed25519 }: CodecRecord<ValidatorSecrets>) {
    return new ValidatorSecrets(bandersnatch, ed25519);
  }

  private constructor(
    public readonly bandersnatch: BandersnatchSecretSeed,
    public readonly ed25519: Ed25519SecretSeed,
  ) {}
}

export class BlockAuthorshipConfig {
  static Codec = codec.Class(BlockAuthorshipConfig, {
    keys: codec.sequenceVarLen(ValidatorSecrets.Codec),
  });

  static create({ keys }: CodecRecord<BlockAuthorshipConfig>) {
    return new BlockAuthorshipConfig(keys);
  }

  private constructor(public readonly keys: ValidatorSecrets[]) {}
}
