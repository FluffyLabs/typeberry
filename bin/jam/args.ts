import { type PvmBackend, PvmBackendNames } from "@typeberry/config";
import { DEFAULT_CONFIG, DEV_CONFIG, NODE_DEFAULTS } from "@typeberry/config-node";
import { isU16, type U16 } from "@typeberry/numbers";
import minimist from "minimist";
import packageJson from "./package.json" with { type: "json" };

export const HELP = `
@typeberry/jam ${packageJson.version} by Fluffy Labs.

Usage:
  jam [options]
  jam [options] dev <dev-validator-index>
  jam [options] import <bin-or-json-blocks>
  jam [options] export <output-directory-or-file>
  jam [options] [--version=1] fuzz-target [socket-path=/tmp/jam_target.sock]

Options:
  --name                Override node name. Affects networking key and db location.
                        [default: ${NODE_DEFAULTS.name}]
  --config              Configuration directives. If specified more than once, they are evaluated and merged from left to right.
                        A configuration directive can be a path to a config file, an inline JSON object, a pseudo-jq query or one of predefined configs ['${DEV_CONFIG}', '${DEFAULT_CONFIG}'].
                        Pseudo-jq queries are a way to modify the config using a subset of jq syntax.
                        Example: --config=dev --config=.chain_spec+={"bootnodes": []}      -- will modify only the bootnodes property of the chain spec (merge).
                        Example: --config=dev --config=.chain_spec={"bootnodes": []}       -- will replace the entire chain spec property with the provided JSON object.
                        Example: --config=dev --config=.chain_spec+=bootnodes.json         -- you may also use JSON files in your queries. This one will merge the contents of bootnodes.json onto the chain spec.
                        Example: --config=dev --config={"chain_spec": { "bootnodes": [] }} -- will merge the provided JSON object onto the "dev" config.
                        Example: --config=dev --config=bootnodes.json                      -- will merge the contents of bootnodes.json onto the "dev" config.
                        Example: --config=custom-config.json                               -- will use the contents of custom-config.json as the config.
                        [default: ${NODE_DEFAULTS.config}]
  --pvm                 PVM Backend, one of: [${PvmBackendNames.join(", ")}].
                        [default: ${PvmBackendNames[NODE_DEFAULTS.pvm]}]
`;

/** Command to execute. */
export enum Command {
  /** Regular node operation. */
  Run = "run",
  /** Run as a development-mode validator. */
  Dev = "dev",
  /** Import the blocks from CLI and finish. */
  Import = "import",
  /** Export blocks to .bin files. */
  Export = "export",
  /** Run as a Fuzz Target. */
  FuzzTarget = "fuzz-target",
}

export type SharedOptions = {
  nodeName: string;
  config: string[];
  pvm: PvmBackend;
};

export type Arguments =
  | CommandArgs<Command.Run, SharedOptions & {}>
  | CommandArgs<
      Command.FuzzTarget,
      SharedOptions & {
        socket: string | null;
        version: 1;
      }
    >
  | CommandArgs<
      Command.Dev,
      SharedOptions & {
        index: U16;
      }
    >
  | CommandArgs<
      Command.Import,
      SharedOptions & {
        files: string[];
      }
    >
  | CommandArgs<
      Command.Export,
      SharedOptions & {
        output: string;
      }
    >;

export function parseSharedOptions(
  args: minimist.ParsedArgs,
  defaultConfig: string[] = NODE_DEFAULTS.config,
): SharedOptions {
  const { name } = parseStringOption(args, "name", (v) => v, NODE_DEFAULTS.name);
  const { config } = parseValueOptionAsArray(
    args,
    "config",
    "string",
    (v: string) => (v === "" ? null : v),
    defaultConfig,
  );
  const { pvm } = parseStringOption(
    args,
    "pvm",
    (v) => {
      const pvm = PvmBackendNames.indexOf(v);
      if (pvm >= 0) {
        return pvm as PvmBackend;
      }
      throw Error(`Use one of ${PvmBackendNames.join(", ")}`);
    },
    NODE_DEFAULTS.pvm,
  );

  return {
    nodeName: name,
    config,
    pvm,
  };
}

export function parseArgs(input: string[], withRelPath: (v: string) => string): Arguments | null {
  const args = minimist(input);
  const command = args._.shift() ?? Command.Run;
  const isHelp = args.help !== undefined;
  if (isHelp) {
    return null;
  }

  switch (command) {
    case Command.Run: {
      const data = parseSharedOptions(args);
      assertNoMoreArgs(args);
      return { command: Command.Run, args: data };
    }
    case Command.Dev: {
      const data = parseSharedOptions(args, [DEV_CONFIG]);
      const index = args._.shift();
      if (index === undefined) {
        throw new Error("Missing dev-validator index.");
      }
      const numIndex = Number(index);
      if (!isU16(numIndex)) {
        throw new Error(`Invalid dev-validator index: ${numIndex}, need U16`);
      }
      assertNoMoreArgs(args);
      return { command: Command.Dev, args: { ...data, index: numIndex } };
    }
    case Command.FuzzTarget: {
      const data = parseSharedOptions(args);
      const { version } = parseValueOption(args, "version", "number", parseFuzzVersion, 1);
      const socket = args._.shift() ?? null;
      assertNoMoreArgs(args);
      return {
        command: Command.FuzzTarget,
        args: {
          ...data,
          version,
          socket,
        },
      };
    }
    case Command.Import: {
      const data = parseSharedOptions(args);
      const files = args._.map((f) => withRelPath(f));
      args._ = [];
      assertNoMoreArgs(args);
      return {
        command: Command.Import,
        args: {
          ...data,
          files,
        },
      };
    }
    case Command.Export: {
      const data = parseSharedOptions(args);
      const output = args._.shift();
      if (output === undefined) {
        throw new Error("Missing output directory.");
      }
      assertNoMoreArgs(args);
      return {
        command: Command.Export,
        args: {
          ...data,
          output: withRelPath(output),
        },
      };
    }
    default: {
      args._.unshift(command);
      assertNoMoreArgs(args);
    }
  }

  throw new Error(`Invalid arguments: ${JSON.stringify(args)}`);
}

function parseStringOption<S extends string, T>(
  args: minimist.ParsedArgs,
  option: S,
  parser: (v: string) => T | null,
  defaultValue: T,
): Record<S, T> {
  return parseValueOption(args, option, "string", parser, defaultValue);
}

function parseValueOptionAsArray<X, S extends string, T>(
  args: minimist.ParsedArgs,
  option: S,
  typeOfX: "number" | "string",
  parser: (v: X) => T | null,
  defaultValue: T[],
): Record<S, T[]> {
  if (args[option] === undefined) {
    return {
      [option]: defaultValue,
    } as Record<S, T[]>;
  }

  const vals: unknown[] = Array.isArray(args[option]) ? args[option] : [args[option]];

  delete args[option];

  const parsedVals: T[] = vals.reduce((result: T[], val: unknown) => {
    const valType = typeof val;
    if (valType !== typeOfX) {
      console.log("valType", valType);
      throw new Error(`Option '--${option}' requires an argument of type: ${typeOfX}, got: ${valType}.`);
    }
    const parsed = parser(val as X);
    if (parsed !== null) {
      result.push(parsed);
    }
    return result;
  }, []);

  return {
    [option]: parsedVals.length > 0 ? parsedVals : defaultValue,
  } as Record<S, T[]>;
}

function parseValueOption<X, S extends string, T>(
  args: minimist.ParsedArgs,
  option: S,
  typeOfX: "number" | "string",
  parser: (v: X) => T | null,
  defaultValue: T,
): Record<S, T> {
  const val = args[option];
  if (val === undefined) {
    return {
      [option]: defaultValue,
    } as Record<S, T>;
  }

  if (Array.isArray(val)) {
    throw new Error(`Option '--${option}' has been specified more than once. Only one value was expected.`);
  }

  delete args[option];
  const valType = typeof val;
  if (valType !== typeOfX) {
    throw new Error(`Option '--${option}' requires an argument of type: ${typeOfX}, got: ${valType}.`);
  }
  try {
    const parsed = parser(val);
    return {
      [option]: parsed ?? defaultValue,
    } as Record<S, T>;
  } catch (e) {
    throw new Error(`Invalid value '${val}' for option '${option}': ${e}`);
  }
}

function assertNoMoreArgs(args: minimist.ParsedArgs) {
  const keys = Object.keys(args);
  const keysLeft = keys.filter((x) => x !== "_" && x !== "--");

  if (args._.length > 0) {
    throw new Error(`Unexpected command: '${args._[0]}'`);
  }

  if ((args["--"]?.length ?? 0) > 0) {
    throw new Error(`Unexpected parameters: '${args["--"]?.[0]}'...`);
  }

  if (keysLeft.length > 0) {
    throw new Error(`Unrecognized options: '${keysLeft}'`);
  }
}

type CommandArgs<T extends Command, Args> = {
  command: T;
  args: Args;
};

function parseFuzzVersion(v: string | number): 1 | null {
  if (v === "") {
    return null;
  }

  const parsed = Number(v);
  if (parsed === 1) {
    return parsed;
  }
  throw new Error(`Invalid fuzzer version: ${v}. Must be 1`);
}
