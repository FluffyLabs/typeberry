import minimist from "minimist";
import packageJson from "./package.json";
import { SUPPORTED_TYPES, type SupportedType } from "./types.js";

export const HELP = `
@typeberry/convert ${packageJson.version} by Fluffy Labs.

Usage:
  convert <type> <hex-or-json-input-file> [to <format>]

Attempts to read provided input file as 'type' and output in requested 'format'.
The input type is detected from file extension ('.hex' or '.json').

Example usage:
  convert [options] header ./genesis-header.json to hex

Options:
  --flavor    - chain spec flavor, either 'full' or 'tiny'.
                [default: tiny]
  --process   - process the type before outputing it. See below
                for supported processing.

Supported generic output formats:
  print       - print the object to the console
  json        - JSON format (when supported)
  hex         - JAM-codec hex-encoded string (when supported)

Processing:
  ${SUPPORTED_TYPES.filter((x) => x.process !== undefined).map(
    (x) => `
  ${x.name}:
    ${x.process?.options.join(", ")}`,
  )}

Supported types:
${SUPPORTED_TYPES.map((x) => `  ${x.name}`).join("\n")}
`;

export type Arguments = {
  flavor: KnownChainSpec;
  process: string;
  type: SupportedType;
  inputPath: string;
  outputFormat: OutputFormat;
};

export enum OutputFormat {
  Print = "print",
  Json = "json",
  Hex = "hex",
}

export function parseArgs(cliInput: string[], withRelPath: (v: string) => string): Arguments {
  const args = minimist(cliInput);
  const chainSpec = parseOption(
    args,
    "flavor",
    (flavor) => {
      switch (flavor) {
        case KnownChainSpec.Tiny:
          return KnownChainSpec.Tiny;
        case KnownChainSpec.Full:
          return KnownChainSpec.Full;
        default:
          throw Error(`unknown flavor: ${flavor}`);
      }
    },
    KnownChainSpec.Tiny,
  );
  const process = parseOption(args, "process", (v) => v, "");

  const type = parseType(args._.shift());
  const input = args._.shift();
  if (input === undefined) {
    throw new Error("Missing input file!");
  }
  checkTo(args._.shift());
  const outputFormat = parseOutputFormat(args._.shift());

  assertNoMoreArgs(args);

  return {
    flavor: chainSpec.flavor,
    type,
    process: process.process,
    inputPath: withRelPath(input),
    outputFormat,
  };
}

function parseType(type?: string) {
  if (type === undefined) {
    throw new Error("Missing input type.");
  }

  const meta = SUPPORTED_TYPES.find((x) => x.name === type);
  if (meta === undefined) {
    throw new Error(`Unsupported input type: '${type}'.`);
  }

  return meta;
}

function checkTo(to?: string) {
  if (to !== undefined && to !== "to") {
    throw new Error(`Missing 'to' before the output type?`);
  }
}

function parseOutputFormat(output?: string): OutputFormat {
  if (output === undefined) {
    return OutputFormat.Print;
  }
  switch (output) {
    case OutputFormat.Print:
      return OutputFormat.Print;
    case OutputFormat.Hex:
      return OutputFormat.Hex;
    case OutputFormat.Json:
      return OutputFormat.Json;
    default:
      throw new Error(`Invalid output format: '${output}'.`);
  }
}

// TODO [ToDr] Consider sharing that?

/** Chain spec chooser. */
export enum KnownChainSpec {
  /** Tiny chain spec. */
  Tiny = "tiny",
  /** Full chain spec. */
  Full = "full",
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
