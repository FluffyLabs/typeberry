import {
  type HeaderHash,
  type TimeSlot,
  tryAsTimeSlot,
  tryAsValidatorIndex,
  type ValidatorIndex,
} from "@typeberry/block";
import type { Bootnode, PvmBackend } from "@typeberry/config";
import type { NodeConfiguration } from "@typeberry/config-node";
import type { Ed25519SecretSeed, KeySeed } from "@typeberry/crypto/key-derivation.js";

export const DEFAULT_DEV_CONFIG = {
  genesisPath: "",
  timeSlot: tryAsTimeSlot(0),
  validatorIndex: tryAsValidatorIndex(0),
};

/**
 * Configuration object for jam node.
 */
export class JamConfig {
  static new({
    isAuthoring,
    nodeName,
    nodeConfig,
    pvmBackend,
    devConfig = null,
    networkConfig = null,
    ancestry = [],
  }: {
    isAuthoring?: boolean;
    nodeName: string;
    nodeConfig: NodeConfiguration;
    pvmBackend: PvmBackend;
    devConfig?: DevConfig | null;
    networkConfig?: NetworkConfig | null;
    ancestry?: [HeaderHash, TimeSlot][];
  }) {
    return new JamConfig(isAuthoring ?? false, nodeName, nodeConfig, pvmBackend, devConfig, networkConfig, ancestry);
  }

  private constructor(
    /** Whether we should be authoring blocks. */
    public readonly isAuthoring: boolean,
    /** Node name. */
    public readonly nodeName: string,
    /** Node starting configuration. */
    public readonly node: NodeConfiguration,
    /** PVM execution engine. */
    public readonly pvmBackend: PvmBackend,
    /** Developer specific configuration. */
    public readonly dev: DevConfig | null,
    /** Networking options. */
    public readonly network: NetworkConfig | null,
    /** Optional pre-genesis ancestry information. */
    public readonly ancestry: [HeaderHash, TimeSlot][],
  ) {}
}

/** Validator key seeds in developer mode. */
export type SeedDevConfig = {
  /** Bandersnatch seed to derive key. */
  bandersnatchSeed: KeySeed;
  /** Bls seed to derive key. */
  blsSeed: KeySeed;
  /** Ed25519 seed to derive key. */
  ed25519Seed: KeySeed;
};

/** Developer mode configuration. */
export type DevConfig = {
  // TODO [ToDr] This should be removed. genesis should be loaded into JIP4 ChainSpec in TCI
  // and passed as `NodeConfiguration`.
  /** Path to genesis state JSON description file. */
  genesisPath: string;
  /** Genesis time slot. */
  timeSlot: TimeSlot;
  /** Validator index for current node. */
  validatorIndex: ValidatorIndex;
  /** Validator seeds in development mode. */
  seed?: SeedDevConfig;
};

/** Networking configuration. */
export type NetworkConfig = {
  /** Networking key seed. */
  key: Ed25519SecretSeed;
  /** Interface to bind networking socket to. */
  host: string;
  /** Port to bind networking socket to. */
  port: number;
  /** Bootnodes to connect to. */
  bootnodes: Bootnode[];
};
