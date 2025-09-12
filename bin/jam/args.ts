import { DEFAULT_CONFIG, DEV_CONFIG, NODE_DEFAULTS } from "@typeberry/config-node";
import { type U16, isU16 } from "@typeberry/numbers";
import minimist from "minimist";
import packageJson from "./package.json" with { type: "json" };

export const HELP = `
@typeberry/jam ${packageJson.version} by Fluffy Labs.

Usage:
  jam [options]
  jam [options] dev <dev-validator-index>
  jam [options] import <bin-or-json-blocks>
  jam [options] [--version=0] fuzz-target

Options:
  --name                Override node name. Affects networking key and db location.
                        [default: ${NODE_DEFAULTS.name}]
  --config              Path to a config file or one of: ['${DEV_CONFIG}', '${DEFAULT_CONFIG}'].
                        [default: ${NODE_DEFAULTS.config}]
`;

/** Command to execute. */
export enum Command {
  /** Regular node operation. */
  Run = "run",
  /** Run as a development-mode validator. */
  Dev = "dev",
  /** Import the blocks from CLI and finish. */
  Import = "import",
  /** Run as a Fuzz Target. */
  FuzzTarget = "fuzz-target",
}

export type SharedOptions = {
  nodeName: string;
  configPath: string;
};

export type FuzzOptions = {
  version: 0 | 1;
};

export type Arguments =
  | CommandArgs<Command.Run, SharedOptions & {}>
  | CommandArgs<Command.FuzzTarget, SharedOptions & FuzzOptions>
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
    >;

function parseSharedOptions(args: minimist.ParsedArgs, withRelPath: (v: string) => string): SharedOptions {
  const { name } = parseStringOption(args, "name", (v) => v, NODE_DEFAULTS.name);
  const { config } = parseStringOption(
    args,
    "config",
    (v) => (v === DEV_CONFIG ? DEV_CONFIG : withRelPath(v)),
    NODE_DEFAULTS.config,
  );

  return {
    nodeName: name,
    configPath: config,
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
      const data = parseSharedOptions(args, withRelPath);
      assertNoMoreArgs(args);
      return { command: Command.Run, args: data };
    }
    case Command.Dev: {
      const data = parseSharedOptions(args, withRelPath);
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
      const data = parseSharedOptions(args, withRelPath);
      const { version } = parseValueOption(args, "version", "number", parseFuzzVersion, 0);
      assertNoMoreArgs(args);
      return {
        command: Command.FuzzTarget,
        args: {
          ...data,
          version,
        },
      };
    }
    case Command.Import: {
      const data = parseSharedOptions(args, withRelPath);
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

function parseFuzzVersion(v: string | number): 0 | 1 | null {
  if (v === "") {
    return null;
  }

  const parsed = Number(v);
  if (parsed === 0 || parsed === 1) {
    return parsed;
  }
  throw new Error(`Invalid fuzzer version: ${v}. Must be either 0 or 1`);
}
