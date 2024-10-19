import {ChainSpec} from "./chainSpec";

export class Config {
  static reinit(config: unknown) {
    const { chainSpec, blocksDbPath } = config as Config;
    return new Config(
      new ChainSpec(chainSpec),
      blocksDbPath
    );
  }

  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly blocksDbPath: string,
  ) {}
}
