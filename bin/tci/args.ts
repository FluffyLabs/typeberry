import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import minimist from "minimist";
import packageJson from "./package.json";

type Hex = Bytes<HASH_SIZE>;
export type OptionHex = Hex | undefined;
export type OptionString = string | undefined;
export type OptionNumber = number | undefined;

export const HELP = `
typeberry ${packageJson.version} by ${packageJson.author}

`;

export type Arguments = {
  bandersnatch: OptionHex;
  bls: OptionHex;
  datadir: OptionString;
  ed25519: OptionHex;
  genesis: OptionString;
  metadata: OptionString;
  port: OptionNumber;
  ts: OptionNumber; // Epoch0 Unix TimeStamp
  validatorindex: OptionNumber;
};

const toHex = (v: string) => {
  if (v.startsWith("0x")) {
    return Bytes.parseBytes(v, HASH_SIZE);
  }
  return Bytes.parseBytesNoPrefix(v, HASH_SIZE);
};
const toOptionString = (v: string): OptionString => v;
const toOptionNumber = (v: string): OptionNumber => Number.parseInt(v);

export function parseArgs(cliInput: string[]): Arguments {
  const args = minimist(cliInput, {
    string: ["bandersnatch", "bls", "datadir", "ed25519", "genesis", "medatada", "port", "ts", "validatorindex"],
  });

  const result: Arguments = {
    bandersnatch: parseValue(args, "bandersnatch", toHex).bandersnatch,
    bls: parseValue(args, "bls", toHex).bls,
    datadir: parseValue(args, "datadir", toOptionString).datadir,
    ed25519: parseValue(args, "ed25519", toHex).ed25519,
    genesis: parseValue(args, "genesis", toOptionString).genesis,
    metadata: parseValue(args, "metadata", toOptionString).metadata,
    port: parseValue(args, "port", toOptionNumber).port,
    ts: parseValue(args, "ts", toOptionNumber).ts,
    validatorindex: parseValue(args, "validatorindex", toOptionNumber).validatorindex,
  };

  assertNoMoreArgs(args);

  return result;
}

function parseValue<S extends string, T>(
  args: minimist.ParsedArgs,
  flag: S,
  parser: (v: string) => T,
): Record<S, T | undefined> {
  const value = args[flag];
  if (value === undefined) {
    return {
      [flag]: value,
    } as Record<S, T>;
  }

  delete args[flag];
  if (typeof value !== "string") {
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
    throw new Error(`Uncrecognized options: ${keysLeft.join(", ")}`);
  }
}
