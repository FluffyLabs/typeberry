import { Bytes } from "@typeberry/bytes";
import { type PublicKeySeed, SEED_SIZE } from "@typeberry/crypto";
import minimist from "minimist";
import packageJson from "./package.json" with { type: "json" };

export const HELP = `
JAM compatible CLI for typeberry ${packageJson.version} by ${packageJson.author}

https://docs.jamcha.in/basics/cli-args

Usage:
  typeberry [options]

Options:
  --bandersnatch hex        Bandersnatch Seed (development only)
  --bls hex                 BLS Seed (development only)
  --datadir path            Directory for blockchain, keystore, and other data
  --ed25519 hex             Ed25519 Seed (development only)
  --genesis path            Genesis state JSON file
  --metadata string         Node metadata (default: "Alice")
  --port int                Network listening port (default: 9900)
  --ts int                  JAM genesis TimeSlot (overrides genesis config)
  --validatorindex int      Validator Index (development only)

Note:
  'hex' is 32 byte hash (64 character string), can be either '0x' prefixed or not.
`;

export type CommonArguments = {
  bandersnatch?: PublicKeySeed;
  bls?: PublicKeySeed;
  datadir?: string;
  ed25519?: PublicKeySeed;
  genesis?: string;
  metadata?: string;
  port?: number;
  ts?: number; // epoch0 unix timestamp
  validatorindex?: number;
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
    string: ["bandersnatch", "bls", "datadir", "ed25519", "genesis", "medatada", "port", "ts", "validatorindex"],
  });

  const result: CommonArguments = {
    bandersnatch: parseValue(args, "bandersnatch", toBytes).bandersnatch,
    bls: parseValue(args, "bls", toBytes).bls,
    datadir: parseValue(args, "datadir", toStr).datadir,
    ed25519: parseValue(args, "ed25519", toBytes).ed25519,
    genesis: parseValue(args, "genesis", toStr).genesis,
    metadata: parseValue(args, "metadata", toStr, "Alice").metadata,
    port: parseValue(args, "port", toNumber).port,
    ts: parseValue(args, "ts", toNumber).ts,
    validatorindex: parseValue(args, "validatorindex", toNumber).validatorindex,
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
    throw new Error(`Uncrecognized flags: ${keysLeft.join(", ")}`);
  }
}
