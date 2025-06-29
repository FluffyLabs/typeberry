import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type U16, isU16 } from "@typeberry/numbers";
import minimist from "minimist";
import { version } from "./package.json";

/** Chain spec chooser. */
export enum KnownChainSpec {
  /** Tiny chain spec. */
  Tiny = "tiny",
  /** Full chain spec. */
  Full = "full",
}

const DEFAULTS = {
  chainSpec: KnownChainSpec.Tiny,
  genesisRoot: Bytes.parseBytes(
    "0xc07cdbce686c64d0a9b6539c70b0bb821b6a74d9de750a46a5da05b5640c290a",
    HASH_SIZE,
  ).asOpaque<StateRootHash>(),
  genesisHeaderHash: Bytes.parseBytes(
    "0x0259fbe900000000000000000000000000000000000000000000000000000000",
    HASH_SIZE,
  ).asOpaque<HeaderHash>(),
  dbPath: "database",
};

// NOTE [ToDr] Instead of adding more options here we should probably
// consider just using JSON config files and only leave the stuff
// that is actually meant to be easily overriden from CLI.
export const HELP = `
typeberry ${version} by Fluffy Labs.

Usage:
  typeberry [options]
  typeberry [options] dev <dev-validator-index>
  typeberry [options] import <bin-or-json-blocks>

Options:
  --chain-spec          Chain Spec to use. Either 'tiny' or 'full'.
                        [default: ${DEFAULTS.chainSpec}]
  --db-path             Directory where database is going to be stored.
                        [default: ${DEFAULTS.dbPath}]
  --genesis-root        Assume a particular genesis root hash to open the DB.
                        [default: ${DEFAULTS.genesisRoot.toString().replace("0x", "")}]
  --genesis-header-hash Override genesis header hash to be used for networking.
                        [default: ${DEFAULTS.genesisHeaderHash.toString().replace("0x", "")}]

  --genesis             Path to a JSON file containing genesis state dump.
                        Takes precedence over --genesis-root.
  --genesis-block       Path to a JSON file containing genesis block.
                        Overrides the default empty block if needed.

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
  genesis: string | null;
  genesisBlock: string | null;
  genesisRoot: StateRootHash;
  genesisHeaderHash: HeaderHash;
  chainSpec: KnownChainSpec;
  dbPath: string;
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

const withRelPath = (relPath: string, p: string) => `${relPath}/${p}`;

function parseSharedOptions(args: minimist.ParsedArgs, relPath: string): SharedOptions {
  const dbPath = parseOption(args, "db-path", (v) => withRelPath(relPath, v), withRelPath(relPath, DEFAULTS.dbPath));
  const genesisRootHash = parseOption(
    args,
    "genesis-root",
    (v) => Bytes.parseBytesNoPrefix(v, HASH_SIZE).asOpaque(),
    DEFAULTS.genesisRoot,
  );
  const genesisHeaderHash = parseOption(
    args,
    "genesis-header-hash",
    (v) => Bytes.parseBytesNoPrefix(v, HASH_SIZE).asOpaque(),
    DEFAULTS.genesisHeaderHash,
  );
  const { genesis } = parseOption(args, "genesis", (v) => withRelPath(relPath, v), null);
  const genesisBlock = parseOption(args, "genesis-block", (v) => withRelPath(relPath, v), null);
  const chainSpec = parseOption(
    args,
    "chain-spec",
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
    DEFAULTS.chainSpec,
  );

  return {
    dbPath: dbPath["db-path"],
    genesisRoot: genesisRootHash["genesis-root"],
    genesisHeaderHash: genesisHeaderHash["genesis-header-hash"],
    genesis: genesis,
    genesisBlock: genesisBlock["genesis-block"],
    chainSpec: chainSpec["chain-spec"],
  };
}

export function parseArgs(input: string[], relPath: string): Arguments {
  const args = minimist(input);
  const command = args._.shift() ?? Command.Run;

  switch (command) {
    case Command.Run: {
      const data = parseSharedOptions(args, relPath);
      assertNoMoreArgs(args);
      return { command: Command.Run, args: data };
    }
    case Command.Dev: {
      const data = parseSharedOptions(args, relPath);
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
      const data = parseSharedOptions(args, relPath);
      const files = args._.map((f) => withRelPath(relPath, f));
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
