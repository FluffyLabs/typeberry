import fs from "node:fs";
import os from "node:os";
import type { JsonObject } from "@typeberry/block-json";
import defaultConfigJson from "@typeberry/configs/typeberry-default.json" with { type: "json" };
import devConfigJson from "@typeberry/configs/typeberry-dev.json" with { type: "json" };
import { type FromJson, json, parseFromJson } from "@typeberry/json-parser";
import { AuthorshipOptions } from "./authorship.js";
import { JipChainSpec } from "./jip-chain-spec.js";

/** Development config. Will accept unsealed blocks for now. */
export const DEV_CONFIG = "dev";
/** Default config file. */
export const DEFAULT_CONFIG = "default";

export const NODE_DEFAULTS = {
  name: os.hostname(),
  config: DEFAULT_CONFIG,
};

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
      $schema: "string",
      version: "number",
      flavor: knownChainSpecFromJson,
      chain_spec: JipChainSpec.fromJson,
      database_base_path: "string",
      authorship: AuthorshipOptions.fromJson,
    },
    NodeConfiguration.new,
  );

  static new({ $schema, version, flavor, chain_spec, database_base_path, authorship }: JsonObject<NodeConfiguration>) {
    if (version !== 1) {
      throw new Error("Only version=1 config is supported.");
    }
    return new NodeConfiguration($schema, version, flavor, chain_spec, database_base_path, authorship);
  }

  private constructor(
    public readonly $schema: string,
    public readonly version: number,
    public readonly flavor: KnownChainSpec,
    public readonly chainSpec: JipChainSpec,
    public readonly databaseBasePath: string,
    public readonly authorship: AuthorshipOptions,
  ) {}
}

export function loadConfig(configPath: string): NodeConfiguration {
  if (configPath === DEFAULT_CONFIG) {
    return parseFromJson(defaultConfigJson, NodeConfiguration.fromJson);
  }

  if (configPath === DEV_CONFIG) {
    return parseFromJson(devConfigJson, NodeConfiguration.fromJson);
  }

  try {
    const configFile = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(configFile);
    return parseFromJson(parsed, NodeConfiguration.fromJson);
  } catch (e) {
    throw new Error(`Unable to load config file from ${configPath}: ${e}`);
  }
}
