import { KnownChainSpec, NODE_DEFAULTS } from "@typeberry/config-node";
import { Level } from "@typeberry/logger";
import { type Arguments, Command } from "./args.js";

export type FuzzEnv = {
  spec: KnownChainSpec;
  socketPath: string;
  dataPath: string;
  logLevel: Level | null;
};

export const JAM_FUZZ = "JAM_FUZZ";
export const JAM_FUZZ_SPEC = "JAM_FUZZ_SPEC";
export const JAM_FUZZ_SOCK_PATH = "JAM_FUZZ_SOCK_PATH";
export const JAM_FUZZ_DATA_PATH = "JAM_FUZZ_DATA_PATH";
export const JAM_FUZZ_LOG_LEVEL = "JAM_FUZZ_LOG_LEVEL";

const REQUIRED_VARS = [JAM_FUZZ_SPEC, JAM_FUZZ_SOCK_PATH, JAM_FUZZ_DATA_PATH] as const;

// Note the JAM-conformance vocabulary uses "debug" but the typeberry Level
// enum names the same level "LOG" (see packages/core/logger/options.ts).
const LOG_LEVELS: Record<string, Level> = {
  error: Level.ERROR,
  warn: Level.WARN,
  info: Level.INFO,
  debug: Level.LOG,
  trace: Level.TRACE,
};

export function readFuzzEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>): FuzzEnv | null {
  const flag = env[JAM_FUZZ] ?? "";
  if (flag.trim().length === 0) {
    return null;
  }

  for (const name of REQUIRED_VARS) {
    const value = env[name] ?? "";
    if (value.trim().length === 0) {
      throw new Error(`${JAM_FUZZ} is set but ${name} is required.`);
    }
  }

  const specRaw = env[JAM_FUZZ_SPEC] ?? "";
  let spec: KnownChainSpec;
  if (specRaw === KnownChainSpec.Tiny) {
    spec = KnownChainSpec.Tiny;
  } else if (specRaw === KnownChainSpec.Full) {
    spec = KnownChainSpec.Full;
  } else {
    throw new Error(
      `${JAM_FUZZ_SPEC} must be one of: ${KnownChainSpec.Tiny}, ${KnownChainSpec.Full}. Got: '${specRaw}'.`,
    );
  }

  let logLevel: Level | null = null;
  const rawLogLevel = env[JAM_FUZZ_LOG_LEVEL] ?? "";
  if (rawLogLevel !== "") {
    const parsed = LOG_LEVELS[rawLogLevel.toLowerCase()];
    if (parsed === undefined) {
      throw new Error(
        `${JAM_FUZZ_LOG_LEVEL} must be one of: ${Object.keys(LOG_LEVELS).join(", ")}. Got: '${rawLogLevel}'.`,
      );
    }
    logLevel = parsed;
  }

  return {
    spec,
    socketPath: env[JAM_FUZZ_SOCK_PATH] ?? "",
    dataPath: env[JAM_FUZZ_DATA_PATH] ?? "",
    logLevel,
  };
}

export function synthesizeFuzzArgs(env: FuzzEnv): Arguments {
  return {
    command: Command.FuzzTarget,
    args: {
      nodeName: NODE_DEFAULTS.name,
      config: [...NODE_DEFAULTS.config, `.flavor="${env.spec}"`],
      pvm: NODE_DEFAULTS.pvm,
      socket: env.socketPath,
      version: 1,
      initGenesisFromAncestry: false,
    },
  };
}
