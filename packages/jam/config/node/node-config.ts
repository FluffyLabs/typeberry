import type { JsonObject } from "@typeberry/block-json";
import { type FromJson, json } from "@typeberry/json-parser";
import { JipChainSpec } from "./jip-chain-spec.js";

/** Chain spec chooser. */
export enum KnownChainSpec {
  /** Tiny chain spec. */
  Tiny = "tiny",
  /** Full chain spec. */
  Full = "full",
}

export const knownChainSpecFromJson = json.fromString((input, ctx): KnownChainSpec => {
  switch (input) {
    case KnownChainSpec.Tiny:
      return KnownChainSpec.Tiny;
    case KnownChainSpec.Full:
      return KnownChainSpec.Full;
    default:
      throw Error(`unknown network flavor: ${input} at ${ctx}`);
  }
}) as FromJson<KnownChainSpec>;

export class NodeConfiguration {
  static fromJson = json.object<JsonObject<NodeConfiguration>, NodeConfiguration>(
    {
      flavor: knownChainSpecFromJson,
      chain_spec: JipChainSpec.fromJson,
      database_base_path: "string",
    },
    NodeConfiguration.new,
  );

  static new({ flavor, chain_spec, database_base_path }: JsonObject<NodeConfiguration>) {
    return new NodeConfiguration(flavor, chain_spec, database_base_path);
  }

  private constructor(
    public readonly flavor: KnownChainSpec,
    public readonly chainSpec: JipChainSpec,
    public readonly databaseBasePath: string,
  ) {}
}
