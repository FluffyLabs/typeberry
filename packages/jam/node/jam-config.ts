import { type TimeSlot, type ValidatorIndex, tryAsTimeSlot, tryAsValidatorIndex } from "@typeberry/block";
import type { NodeConfiguration } from "@typeberry/config-node";
import type { Ed25519SecretSeed, KeySeed } from "@typeberry/crypto/key-derivation.js";
import type { Bootnode } from "@typeberry/config";

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
    devConfig,
    seedConfig,
    networkConfig,
  }: {
    isAuthoring?: boolean;
    nodeName: string;
    nodeConfig: NodeConfiguration;
    devConfig?: DevConfig;
    seedConfig?: SeedDevConfig;
    networkConfig?: NetworkConfig;
  }) {
    let fullConfig: FullDevConfig = devConfig ?? { ...DEFAULT_DEV_CONFIG };

    if (seedConfig !== undefined) {
      fullConfig = { ...fullConfig, ...seedConfig };
    }

    return new JamConfig(isAuthoring ?? false, nodeName, nodeConfig, fullConfig, networkConfig ?? null);
  }

  private constructor(
    /** Whether we should be authoring blocks. */
    public readonly isAuthoring: boolean,
    /** Node name. */
    public readonly nodeName: string,
    /** Node starting configuration. */
    public readonly node: NodeConfiguration,
    /** Developer specific configuration. */
    public readonly dev: FullDevConfig,
    /** Networking options. */
    public readonly network: NetworkConfig | null,
  ) {}
}

/**
 * Configuration object for developers.
 * Allow to specify parameters in more detail.
 *
 * NOTE: Mostly required for TestNet
 */
export type FullDevConfig = DevConfig | (DevConfig & SeedDevConfig);

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
  /** Path to genesis state JSON description file. */
  genesisPath: string;
  /** Genesis time slot. */
  timeSlot: TimeSlot;
  /** Validator index for current node. */
  validatorIndex: ValidatorIndex;
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
