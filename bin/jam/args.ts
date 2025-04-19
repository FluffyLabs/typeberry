import minimist from "minimist";

export enum Command {
  Run = "run",
  Import = "import",
}
/** Chain spec chooser. */
export enum KnownChainSpec {
  Tiny = "tiny",
  Full = "full",
}

type SharedOptions = {
  chainSpec: KnownChainSpec;
};

export type Arguments =
  | CommandArgs<Command.Run, SharedOptions & {}>
  | CommandArgs<
      Command.Import,
      SharedOptions & {
        files: string[];
      }
    >;

export function parseArgs(input: string[], relPath: string): Arguments {
  const args = minimist(input);
  const command = args._.shift() ?? Command.Run;

  switch (command) {
    case Command.Run: {
      const data = parseSharedOptions(args);
      assertNoMoreArgs(args);
      return { command: Command.Run, args: data };
    }
    case Command.Import: {
      const data = parseSharedOptions(args);
      const files = args._.map((f) => `${relPath}/${f}`);
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

function parseSharedOptions(args: minimist.ParsedArgs): SharedOptions {
  const d = parseOption(
    args,
    "chainSpec",
    (v) => {
      switch (v) {
        case KnownChainSpec.Tiny:
          return KnownChainSpec.Tiny;
        case KnownChainSpec.Full:
          return KnownChainSpec.Full;
        default:
          throw Error("unknown chainspec");
      }
    },
    KnownChainSpec.Tiny,
  );

  return {
    ...d,
  };
}

function parseOption<S extends string, T>(
  args: minimist.ParsedArgs,
  option: S,
  parser: (v: string) => T | null,
  defaultValue: T,
): Record<S, T> {
  if (args[option] === undefined) {
    return {
      [option]: defaultValue,
    } as Record<S, T>;
  }

  const val = args[option];
  delete args[option];
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

// NOTE [ToDr] Instead of adding more options here we should probably
// consider just using JSON config files and only leave the stuff
// that is actually meant to be easily overriden from CLI.
export const HELP = `
typeberry ${require("./package.json").version} by Fluffy Labs.

Usage:
  typeberry [options]
  typeberry [options] import <bin-or-json-blocks>

Options:
  --chain-spec          Chain Spec to use. Either 'tiny' or 'full'.
`;

type CommandArgs<T extends Command, Args> = {
  command: T;
  args: Args;
};
