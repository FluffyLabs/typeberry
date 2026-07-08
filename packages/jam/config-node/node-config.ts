import fs from "node:fs";
import os from "node:os";
import { PvmBackend } from "@typeberry/config";
import { configs } from "@typeberry/configs";
import { type FromJson, json, parseFromJson } from "@typeberry/json-parser";
import { Logger } from "@typeberry/logger";
import { isBrowser } from "@typeberry/utils";
import { AuthorshipOptions } from "./authorship.js";
import { JipChainSpec } from "./jip-chain-spec.js";
import { RpcOptions } from "./rpc.js";

const logger = Logger.new(import.meta.filename, "config");

/** Development config. Will accept unsealed blocks for now. */
export const DEV_TINY_CONFIG = "dev";
export const DEV_FULL_CONFIG = "dev-full";

/** Default config file. */
export const DEFAULT_CONFIG = "default";

export const NODE_DEFAULTS = {
  name: isBrowser() ? "browser" : os.hostname(),
  config: [DEFAULT_CONFIG],
  pvm: PvmBackend.Ananas,
};

/** Chain spec chooser. */
export enum KnownChainSpec {
  /** Tiny chain spec. */
  Tiny = "tiny",
  /** Full chain spec. */
  Full = "full",
}

/** Persistent regular-node database backend. */
export enum RegularStateBackend {
  Fjall = "fjall",
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

export const regularStateBackendFromJson = json.fromString((input, ctx): RegularStateBackend => {
  switch (input) {
    case RegularStateBackend.Fjall:
      return RegularStateBackend.Fjall;
    default:
      throw Error(`unknown state backend: ${input} at ${ctx}`);
  }
}) as FromJson<RegularStateBackend>;

type NodeConfigurationJson = {
  $schema: string;
  version: number;
  flavor: KnownChainSpec;
  chain_spec: JipChainSpec;
  database_base_path?: string;
  state_backend?: RegularStateBackend;
  authorship: AuthorshipOptions;
  rpc?: RpcOptions;
};

export class NodeConfiguration {
  static fromJson = json.object<NodeConfigurationJson, NodeConfiguration>(
    {
      $schema: "string",
      version: "number",
      flavor: knownChainSpecFromJson,
      chain_spec: JipChainSpec.fromJson,
      database_base_path: json.optional("string"),
      state_backend: json.optional(regularStateBackendFromJson),
      authorship: AuthorshipOptions.fromJson,
      rpc: json.optional(RpcOptions.fromJson),
    },
    NodeConfiguration.new,
  );

  static new({
    $schema,
    version,
    flavor,
    chain_spec,
    database_base_path,
    state_backend,
    authorship,
    rpc,
  }: NodeConfigurationJson) {
    if (version !== 1) {
      throw new Error("Only version=1 config is supported.");
    }
    return new NodeConfiguration(
      $schema,
      version,
      flavor,
      chain_spec,
      database_base_path ?? undefined,
      state_backend ?? RegularStateBackend.Fjall,
      authorship,
      rpc ?? undefined,
    );
  }

  private constructor(
    public readonly $schema: string,
    public readonly version: number,
    public readonly flavor: KnownChainSpec,
    public readonly chainSpec: JipChainSpec,
    /** If database path is not provided, we load an in-memory db. */
    public readonly databaseBasePath: string | undefined,
    /** Persistent database backend used when `databaseBasePath` is set. */
    public readonly stateBackend: RegularStateBackend,
    public readonly authorship: AuthorshipOptions,
    /** Optional RPC server configuration. When present, an in-process RPC server is started. */
    public readonly rpc: RpcOptions | undefined,
  ) {}
}

export function loadConfig(config: string[], withRelPath: (p: string) => string): NodeConfiguration {
  logger.log`🔧 Loading config`;
  let mergedJson: AnyJsonObject = {};

  for (const entry of config) {
    logger.log`🔧 Applying '${entry}'`;

    if (entry === DEV_TINY_CONFIG) {
      mergedJson = structuredClone(configs.devTiny); // clone to avoid mutating the original config. not doing a merge since dev and default should theoretically replace all properties.
      continue;
    }

    if (entry === DEV_FULL_CONFIG) {
      mergedJson = structuredClone(configs.devFull); // clone to avoid mutating the original config. not doing a merge since dev and default should theoretically replace all properties.
      continue;
    }

    if (entry === DEFAULT_CONFIG) {
      mergedJson = structuredClone(configs.default);
      continue;
    }

    // try to parse as JSON
    try {
      const parsed = JSON.parse(entry);
      deepMerge(mergedJson, parsed);
      continue;
    } catch {}

    // if not, try to load as file
    if (entry.indexOf("=") === -1 && entry.endsWith(".json")) {
      try {
        const configFile = fs.readFileSync(withRelPath(entry), "utf8");
        const parsed = JSON.parse(configFile);
        deepMerge(mergedJson, parsed);
      } catch (e) {
        throw new Error(`Unable to load config from ${entry}: ${e}`);
      }
    } else {
      // finally try to process as a pseudo-jq query
      try {
        processQuery(mergedJson, entry, withRelPath);
      } catch (e) {
        throw new Error(`Error while processing '${entry}': ${e}`);
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

function deepMerge(target: AnyJsonObject, source: JsonValue): void {
  if (!isJsonObject(source)) {
    throw new Error(`Expected object, got ${source}`);
  }
  for (const key in source) {
    if (isJsonObject(source[key])) {
      if (!isJsonObject(target[key])) {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
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

    let parsedValue: JsonValue;
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
      if (!isJsonObject(target[part])) {
        target[part] = {};
      }
      if (i === pathParts.length - 1) {
        if (merge) {
          deepMerge(target[part], parsedValue);
        } else {
          target[part] = parsedValue;
        }
        return;
      }
      target = target[part];
    }
  }

  throw new Error("Unrecognized syntax.");
}

type JsonValue = string | number | boolean | null | AnyJsonObject | JsonArray;

interface AnyJsonObject {
  [key: string]: JsonValue;
}

interface JsonArray extends Array<JsonValue> {}

function isJsonObject(value: JsonValue): value is AnyJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
