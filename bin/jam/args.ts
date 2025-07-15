import os from "node:os";
import { type U16, isU16 } from "@typeberry/numbers";
import minimist from "minimist";
import packageJson from "./package.json" with { type: "json" };

export const DEV_CONFIG = "dev";

export const DEFAULTS = {
  name: os.hostname(),
  config: DEV_CONFIG,
};

export const HELP = `
@typeberry/jam ${packageJson.version} by Fluffy Labs.

Usage:
  jam [options]
  jam [options] dev <dev-validator-index>
  jam [options] import <bin-or-json-blocks>

Options:
  --name                Override node name. Affects networking key and db location.
                        [default: ${DEFAULTS.name}]
  --config              Path to a config file or '${DEV_CONFIG}'.
                        [default: ${DEFAULTS.config}]
`;

/** Command to execute. */
export enum Command {
  /** Regular node operation. */
  Run = "run",
  /** Run in as a development-mode validator. */
  Dev = "dev",
  /** Import the blocks from CLI and finish. */
  Import = "import",
}

export type SharedOptions = {
  nodeName: string;
  configPath: string;
};

export type Arguments =
  | CommandArgs<Command.Run, SharedOptions & {}>
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
  const { name } = parseValueOption(args, "name", (v) => v, DEFAULTS.name);
  const { config } = parseValueOption(
    args,
    "config",
    (v) => {
      if (v === DEV_CONFIG) {
        return DEV_CONFIG;
      }
      return withRelPath(v);
    },
    DEFAULTS.config,
  );

  return {
    nodeName: name,
    configPath: config,
  };
}

export function parseArgs(input: string[], withRelPath: (v: string) => string): Arguments {
  const args = minimist(input);
  const command = args._.shift() ?? Command.Run;

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

function parseValueOption<S extends string, T>(
  args: minimist.ParsedArgs,
  option: S,
  parser: (v: string) => T | null,
  defaultValue: T,
): Record<S, T> {
  const val = args[option];
  if (val === undefined) {
    return {
      [option]: defaultValue,
    } as Record<S, T>;
  }

  delete args[option];
  if (typeof val !== "string") {
    throw new Error(`Option '--${option}' requires an argument.`);
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
