import { ChainSpec } from "./chain-spec.js";

/**
 * Configuration object for typeberry workers.
 */
export class Config {
  /**
   * Since we loose prototypes when transferring the context,
   * this function is re-initializing proper types.
   */
  static reInit(config: unknown) {
    const { chainSpec, dbPath, typeberryMode } = config as Config;
    return new Config(new ChainSpec(chainSpec), dbPath, typeberryMode);
  }

  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly dbPath: string,
    public readonly typeberryMode: boolean = false,
  ) {}
}
