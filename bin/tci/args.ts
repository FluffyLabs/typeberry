import { Bytes } from "@typeberry/bytes";
import { type PublicKeySeed, SEED_SIZE } from "@typeberry/crypto";
import minimist from "minimist";
import packageJson from "./package.json" with { type: "json" };

enum TciFlag {
  bandersnatch = "bandersnatch",
  bls = "bls",
  datadir = "datadir",
  ed25519 = "ed25519",
  genesis = "genesis",
  metadata = "metadata",
  port = "port",
  timestamp = "ts",
  validatorindex = "validatorindex",
}

export const HELP = `
Cross-implementation compatible CLI for typeberry ${packageJson.version} by ${packageJson.author}

https://docs.jamcha.in/basics/cli-args

Usage:
  typeberry [options]

Options:
  --${TciFlag.bandersnatch} hex        Bandersnatch Seed (development only)
  --${TciFlag.bls} hex                 BLS Seed (development only)
  --${TciFlag.datadir} path            Directory for blockchain, keystore, and other data
  --${TciFlag.ed25519} hex             Ed25519 Seed (development only)
  --${TciFlag.genesis} path            Genesis state JSON file
  --${TciFlag.metadata} string         Node metadata (default: "Alice")
  --${TciFlag.port} int                Network listening port (default: 9900)
  --${TciFlag.timestamp} int                  JAM genesis TimeSlot (overrides genesis config)
  --${TciFlag.validatorindex} int      Validator Index (development only)

Note:
  'hex' is 32 byte hash (64 character string), can be either '0x' prefixed or not.
`;

export type CommonArguments = {
  [TciFlag.bandersnatch]?: PublicKeySeed;
  [TciFlag.bls]?: PublicKeySeed;
  [TciFlag.datadir]?: string;
  [TciFlag.ed25519]?: PublicKeySeed;
  [TciFlag.genesis]?: string;
  [TciFlag.metadata]?: string;
  [TciFlag.port]?: number;
  [TciFlag.timestamp]?: number; // epoch0 unix timestamp
  [TciFlag.validatorindex]?: number;
};

const toBytes = (v: string): PublicKeySeed => {
  if (v.startsWith("0x")) {
    return Bytes.parseBytes(v, SEED_SIZE).asOpaque();
  }
  return Bytes.parseBytesNoPrefix(v, SEED_SIZE).asOpaque();
};
const toStr = (v: string) => v;
const toNumber = (v: string): number => {
  const val = Number.parseInt(v);
  if (Number.isNaN(val)) {
    throw Error(`Cannot parse '${v}' as a number.`);
  }
  return val;
};

export function parseArgs(cliInput: string[]): CommonArguments {
  const args = minimist(cliInput, {
    string: [
      TciFlag.bandersnatch,
      TciFlag.bls,
      TciFlag.datadir,
      TciFlag.ed25519,
      TciFlag.genesis,
      TciFlag.metadata,
      TciFlag.port,
      TciFlag.timestamp,
      TciFlag.validatorindex,
    ],
  });

  const result: CommonArguments = {
    bandersnatch: parseValue(args, TciFlag.bandersnatch, toBytes).bandersnatch,
    bls: parseValue(args, TciFlag.bls, toBytes).bls,
    datadir: parseValue(args, TciFlag.datadir, toStr).datadir,
    ed25519: parseValue(args, TciFlag.ed25519, toBytes).ed25519,
    genesis: parseValue(args, TciFlag.genesis, toStr).genesis,
    metadata: parseValue(args, TciFlag.metadata, toStr, "Alice").metadata,
    port: parseValue(args, TciFlag.port, toNumber).port,
    ts: parseValue(args, TciFlag.timestamp, toNumber).ts,
    validatorindex: parseValue(args, TciFlag.validatorindex, toNumber).validatorindex,
  };

  assertNoMoreArgs(args);

  return result;
}

function parseValue<S extends string, T>(
  args: minimist.ParsedArgs,
  flag: S,
  parser: (v: string) => T,
  defaultValue?: T | undefined,
): Record<S, T | undefined> {
  const value = args[flag];
  if (value === undefined) {
    return {
      [flag]: defaultValue,
    } as Record<S, T>;
  }

  delete args[flag];
  if (value === "") {
    throw new Error(`Option --${flag} requires an argument.`);
  }

  try {
    const parsed = parser(value);
    return {
      [flag]: parsed,
    } as Record<S, T>;
  } catch (e) {
    throw new Error(`Invalid value '${value}' for flag '--${flag}': ${e}`);
  }
}

function assertNoMoreArgs(args: minimist.ParsedArgs): void {
  const keys = Object.keys(args);
  const keysLeft = keys.filter((k) => k !== "_" && k !== "--");

  if (args._.length > 0) {
    throw new Error(`Unexpected commands: ${args._.join(", ")}`);
  }
  if ((args["--"]?.length ?? 0) > 0) {
    throw new Error(`Unexpected parameters: ${args["--"]?.join(", ")}`);
  }
  if (keysLeft.length > 0) {
    throw new Error(`Unrecognized flags: ${keysLeft.join(", ")}`);
  }
}
