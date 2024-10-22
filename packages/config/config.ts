import { ChainSpec } from "./chainSpec";

/**
 * Configuration object for typeberry workers.
 */
export class Config {
  /**
   * Since we loose prototypes when transferring the context,
   * this function is re-initializing proper types.
   */
  static reInit(config: unknown) {
    const { chainSpec, blocksDbPath } = config as Config;
    return new Config(new ChainSpec(chainSpec), blocksDbPath);
  }

  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly blocksDbPath: string,
  ) {}
}
