import { type TimeSlot, type ValidatorIndex, tryAsTimeSlot, tryAsValidatorIndex } from "@typeberry/block";
import type { Bytes } from "@typeberry/bytes";
import type { NodeConfiguration } from "@typeberry/config-node";
import type { HASH_SIZE } from "@typeberry/hash";

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
    blockToImport,
    nodeName,
    nodeConfig,
    devConfig,
    seedConfig,
  }: {
    isAuthoring?: boolean;
    blockToImport?: string[];
    nodeName: string;
    nodeConfig: NodeConfiguration;
    devConfig?: DevConfig;
    seedConfig?: SeedDevConfig;
  }) {
    let fullConfig: FullDevConfig = devConfig ?? { ...DEFAULT_DEV_CONFIG };

    if (seedConfig !== undefined) {
      fullConfig = { ...fullConfig, ...seedConfig };
    }

    return new JamConfig(isAuthoring ?? false, blockToImport ?? [], nodeName, nodeConfig, fullConfig);
  }

  private constructor(
    /** Whether we should be authoring blocks. */
    public readonly isAuthoring: boolean,
    /** Paths to JSON or binary blocks to import (ordered). */
    public readonly blocksToImport: string[],
    /** Node name. */
    public readonly nodeName: string,
    /** Node starting configuration. */
    public readonly node: NodeConfiguration,
    /** Node developer specific configuration. */
    public readonly dev: FullDevConfig,
  ) {}
}

/**
 * Configuration object for developers.
 * Allow to specify parameters in more detail.
 *
 * NOTE: Mostly required for TestNet
 */
export type FullDevConfig = DevConfig | (DevConfig & SeedDevConfig);

export type SeedDevConfig = {
  /** Bandersnatch seed to derive key. */
  bandersnatchSeed: Bytes<HASH_SIZE>;
  /** Bls seed to derive key. */
  blsSeed: Bytes<HASH_SIZE>;
  /** Ed25519 seed to derive key. */
  ed25519Seed: Bytes<HASH_SIZE>;
};

export type DevConfig = {
  /** Path to genesis state JSON description file. */
  genesisPath: string;
  /** Genesis time slot. */
  timeSlot: TimeSlot;
  /** Validator index for current node. */
  validatorIndex: ValidatorIndex;
};
