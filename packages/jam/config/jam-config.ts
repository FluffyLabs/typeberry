import { type TimeSlot, type ValidatorIndex, tryAsTimeSlot, tryAsValidatorIndex } from "@typeberry/block";
import type { Bytes } from "@typeberry/bytes";
import type { NodeConfiguration } from "@typeberry/config-node";
import type { HASH_SIZE } from "@typeberry/hash";

export const DEV_CONFIG: DevConfig = {
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
    let dev: DevConfig;
    if (devConfig !== undefined) {
      dev = devConfig;
    } else {
      dev = DEV_CONFIG;
    }

    let full: FullDevConfig;
    if (seedConfig !== undefined) {
      full = { ...dev, ...seedConfig };
    } else {
      full = dev;
    }

    return new JamConfig(isAuthoring ?? false, blockToImport ?? [], nodeName, nodeConfig, full);
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
  /** Use predefined bandersnatch seed to derive bandersnatch key. */
  bandersnatchSeed: Bytes<HASH_SIZE>;
  /** Use predefined bls seed to derive bls key. */
  blsSeed: Bytes<HASH_SIZE>;
  /** Use predefined ed25519 seed to derive ed25519 key. */
  ed25519Seed: Bytes<HASH_SIZE>;
};

export type DevConfig = {
  /** Use to provide path for genesis state */
  genesisPath: string;
  /** Use to override genesis head config slot. */
  timeSlot: TimeSlot;
  /** Use to specify validator index that will be used as for current node. */
  validatorIndex: ValidatorIndex;
};
