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
  config: [DEFAULT_CONFIG],
  pvm: PvmBackend.BuiltIn,
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

/**
 * We need to properly handle 2 cases:
 *   1) "dev" or "default" are explicitly requested and we merge the rest of entries onto that
 *   2) a path to a full json config file is provided, then we merge the remaining entries onto it
 */
export function loadConfig(config: string[], withRelPath: (p: string) => string): NodeConfiguration {
  logger.log`🔧 Loading config`;
  let mergedJson: AnyJsonObject = {};
  let startWithSegment = 1; // "dev" or "default" is the first segment, so we start merging from the second one

  if (config[0] === DEV_CONFIG) {
    logger.log`🔧 Applying dev config`;
    mergedJson = structuredClone(configs.dev);
  } else if (config[0] === DEFAULT_CONFIG) {
    mergedJson = structuredClone(configs.default);
  } else {
    startWithSegment = 0; // neither "dev" nor "default" was requested, so we expect the user to provide a full config
  }

  for (let i = startWithSegment; i < config.length; i++) {
    logger.log`🔧 Applying '${config[i]}'`;

    // try to parse as JSON
    try {
      const parsed = JSON.parse(config[i]);
      deepMerge(mergedJson, parsed);
    } catch {
      // if not, try to load as file
      if (config[i].indexOf("=") === -1 && config[i].endsWith(".json")) {
        try {
          const configFile = fs.readFileSync(withRelPath(config[i]), "utf8");
          const parsed = JSON.parse(configFile);
          deepMerge(mergedJson, parsed);
        } catch (e) {
          throw new Error(`Unable to load config from ${config[i]}: ${e}`);
        }
      } else {
        // finally try to process as a pseudo-jq query
        try {
          processQuery(mergedJson, config[i], withRelPath);
        } catch (e) {
          throw new Error(`Error while processing '${config[i]}': ${e}`);
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

function deepMerge(target: AnyJsonObject, source: AnyJsonObject) {
  for (const key in source) {
    if (typeof source[key] === "object" && !Array.isArray(source[key])) {
      if (!(key in target)) {
        target[key] = {};
      }
      deepMerge(target[key] as AnyJsonObject, source[key] as AnyJsonObject);
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
    let [path, value] = queryParts.map((part) => part.trim());
    let merge = false;

    // detect += syntax
    if (path.endsWith("+")) {
      merge = true;
      path = path.slice(0, -1);
    }

    let parsedValue: AnyJsonObject;
    if (value.endsWith(".json")) {
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
          target[part] = deepMerge(target[part] as AnyJsonObject, parsedValue);
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
