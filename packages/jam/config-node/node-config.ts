import fs from "node:fs";
import os from "node:os";
import type { JsonObject } from "@typeberry/block-json";
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

const IGNORE_KEYS = ["$schema"];

export const NODE_DEFAULTS = {
  name: isBrowser() ? "browser" : os.hostname(),
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

/**
 * We need to properly handle 2 cases:
 *   1) the user only provides overrides (no "dev" or "default" specified) - we assume "default" as base and merge all user-provided entries onto it
 *   2) the user explicitly requests "dev" or "default" and we merge the rest of entries onto that
 */
export function loadConfig(config: string[], withRelPath: (p: string) => string): NodeConfiguration {
  logger.log`🔧 Loading config`;
  let mergedJson: AnyJsonObject;
  let startWithSegment = 1; // "dev" or "default" is the first segment, so we start merging from the second one

  if (config[0] === DEV_CONFIG) {
    logger.log`🔧 Applying dev config`;
    mergedJson = configs.dev;
  } else {
    logger.log`🔧 Applying default config`;
    mergedJson = configs.default;
    if (config[0] !== DEFAULT_CONFIG) {
      startWithSegment = 0; // user didn't request "dev" or "default" so we merge all entries onto "default"
    }
  }

  for (let i = startWithSegment; i < config.length; i++) {
    logger.log`🔧 Applying '${config[i]}'`;

    // try to parse as JSON
    try {
      const parsed = JSON.parse(config[i]);
      deepMerge(mergedJson, parsed, IGNORE_KEYS);
    } catch {
      // if not, try to load as file
      if (fs.existsSync(withRelPath(config[i]))) {
        try {
          const configFile = fs.readFileSync(withRelPath(config[i]), "utf8");
          const parsed = JSON.parse(configFile);
          deepMerge(mergedJson, parsed, IGNORE_KEYS);
        } catch (e) {
          throw new Error(`Unable to load config from ${config[i]}: ${e}`);
        }
      } else {
        // finally try to process as a pseudo-jq query
        try {
          processQuery(mergedJson, config[i], withRelPath);
        } catch (e) {
          throw new Error(`🔧 Error while processing '${config[i]}': ${e}`);
        }
      }
    }
  }

  try {
    const parsed = parseFromJson(mergedJson, NodeConfiguration.fromJson);
    logger.log`🔧 Config ready`;
    return parsed;
  } catch (e) {
    throw new Error(`Unable to parse config: ${e}`);
  }
}

// biome-ignore lint/suspicious/noExplicitAny: processing raw json objects
function deepMerge(target: any, source: any, ignoreKeys: string[] = []) {
  for (const key in source) {
    if (ignoreKeys.includes(key)) {
      continue;
    }
    if (key in source && typeof source[key] === "object" && !Array.isArray(source[key])) {
      if (!(key in target)) {
        target[key] = {};
      }
      deepMerge(target[key], source[key], ignoreKeys);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

/**
 * Caution: updates input directly.
 * Processes a pseudo-jq query. Syntax:
 * .path.to.value = { ... } - updates value with the specified object by replacement
 * .path.to.value += { ... } - updates value with the specified object by merging
 * .path.to.value = file.json - updates value with the contents of file.json
 * .path.to.value += file.json - merges the contents of file.json onto value
 */
function processQuery(input: AnyJsonObject, query: string, withRelPath: (p: string) => string): void {
  const queryParts = query.split("=");

  if (queryParts.length === 2) {
    let [path, value] = queryParts;
    let merge = false;

    // detect += syntax
    if (path.endsWith("+")) {
      merge = true;
      path = path.slice(0, -1).trim();
    }

    let parsedValue: AnyJsonObject;
    if (fs.existsSync(withRelPath(value))) {
      try {
        const configFile = fs.readFileSync(withRelPath(value), "utf8");
        const parsed = JSON.parse(configFile);
        parsedValue = parsed;
      } catch (e) {
        throw new Error(`Unable to load config from ${value}: ${e}`);
      }
    } else {
      try {
        parsedValue = JSON.parse(value);
      } catch (e) {
        throw new Error(`Unrecognized syntax '${value}': ${e}`);
      }
    }

    let pathParts = path.split(".");

    // allow leading dot in path
    if (pathParts[0] === "") {
      pathParts = pathParts.slice(1);
    }

    let target = input;
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (i === pathParts.length - 1) {
        if (merge) {
          target[part] = deepMerge(target[part], parsedValue);
        } else {
          target[part] = parsedValue;
        }
        return;
      }
      if (typeof target[part] !== "object") {
        target[part] = {};
      }
      target = target[part] as AnyJsonObject;
    }
  }

  throw new Error("Unrecognized syntax.");
}

type JsonValue = string | number | boolean | null | AnyJsonObject | JsonArray;

interface AnyJsonObject {
  [key: string]: JsonValue;
}

interface JsonArray extends Array<JsonValue> {}
