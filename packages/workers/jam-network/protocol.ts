import { Block, type HeaderHash, headerViewWithHashCodec } from "@typeberry/block";
import { type CodecRecord, codec } from "@typeberry/codec";
import { ED25519_PRIV_KEY_BYTES, type Ed25519SecretSeed } from "@typeberry/crypto";
import { HASH_SIZE } from "@typeberry/hash";
import type { U16 } from "@typeberry/numbers";
import { WithDebug } from "@typeberry/utils";
import { type Api, createProtocol, type Internal } from "@typeberry/workers-api";

/** Network-specific worker initialisatation. */
export class NetworkingConfig extends WithDebug {
  static Codec = codec.Class(NetworkingConfig, {
    genesisHeaderHash: codec.bytes(HASH_SIZE).asOpaque<HeaderHash>(),
    key: codec.bytes(ED25519_PRIV_KEY_BYTES).asOpaque<Ed25519SecretSeed>(),
    host: codec.string,
    port: codec.u16,
    bootnodes: codec.sequenceVarLen(codec.string),
  });

  static create({ genesisHeaderHash, key, host, port, bootnodes }: CodecRecord<NetworkingConfig>) {
    return new NetworkingConfig(genesisHeaderHash, key, host, port, bootnodes);
  }

  private constructor(
    /** Genesis header hash. */
    public readonly genesisHeaderHash: HeaderHash,
    /** Ed25519 private key. */
    public readonly key: Ed25519SecretSeed,
    /** Host to bind the networking to. */
    public readonly host: string,
    /** Port to bind the networking to. */
    public readonly port: U16,
    /** List of bootnode addresses. */
    public readonly bootnodes: string[],
  ) {
    super();
  }
}

export const protocol = createProtocol("net", {
  toWorker: {
    newHeader: {
      request: headerViewWithHashCodec,
      response: codec.nothing,
    },
    finish: {
      request: codec.nothing,
      response: codec.nothing,
    },
  },
  fromWorker: {
    blocks: {
      request: codec.sequenceVarLen(Block.Codec.View),
      response: codec.nothing,
    },
  },
});

export type NetworkingInternal = Internal<typeof protocol>;
export type NetworkingApi = Api<typeof protocol>;
