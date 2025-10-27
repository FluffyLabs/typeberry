import fs from "node:fs";
import os from "node:os";
import type { JsonObject } from "@typeberry/block-json";
import { PvmBackend } from "@typeberry/config";
import { configs } from "@typeberry/configs";
import { type FromJson, json, parseFromJson } from "@typeberry/json-parser";
import { Logger } from "@typeberry/logger";
import { isBrowser } from "@typeberry/utils";
import { AuthorshipOptions } from "./authorship.js";
import { JipChainSpec } from "./jip-chain-spec.js";

const logger = Logger.new(import.meta.filename, "config");

/** Development config. Will accept unsealed blocks for now. */
export const DEV_CONFIG = "dev";
/** Default config file. */
export const DEFAULT_CONFIG = "default";

export const NODE_DEFAULTS = {
  name: isBrowser() ? "browser" : os.hostname(),
  config: DEFAULT_CONFIG,
  pvm: PvmBackend.Ananas,
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
      database_base_path: json.optional("string"),
      authorship: AuthorshipOptions.fromJson,
    },
    NodeConfiguration.new,
  );

  static new({ $schema, version, flavor, chain_spec, database_base_path, authorship }: JsonObject<NodeConfiguration>) {
    if (version !== 1) {
      throw new Error("Only version=1 config is supported.");
    }
    return new NodeConfiguration($schema, version, flavor, chain_spec, database_base_path ?? undefined, authorship);
  }

  private constructor(
    public readonly $schema: string,
    public readonly version: number,
    public readonly flavor: KnownChainSpec,
    public readonly chainSpec: JipChainSpec,
    /** If database path is not provided, we load an in-memory db. */
    public readonly databaseBasePath: string | undefined,
    public readonly authorship: AuthorshipOptions,
  ) {}
}

export function loadConfig(configPath: string): NodeConfiguration {
  if (configPath === DEFAULT_CONFIG) {
    logger.log`🔧 Loading DEFAULT config`;
    return parseFromJson(configs.default, NodeConfiguration.fromJson);
  }

  if (configPath === DEV_CONFIG) {
    logger.log`🔧 Loading DEV config`;
    return parseFromJson(configs.dev, NodeConfiguration.fromJson);
  }

  try {
    logger.log`🔧 Loading config from ${configPath}`;
    const configFile = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(configFile);
    return parseFromJson(parsed, NodeConfiguration.fromJson);
  } catch (e) {
    throw new Error(`Unable to load config file from ${configPath}: ${e}`);
  }
}
