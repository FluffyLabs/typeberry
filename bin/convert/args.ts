import minimist from "minimist";
import packageJson from "./package.json" with { type: "json" };
import { SUPPORTED_TYPES, type SupportedType } from "./types.js";

export const HELP = `
@typeberry/convert ${packageJson.version} by Fluffy Labs.

Usage:
  @typeberry/convert [options] <bin-hex-or-json-input-file> <type> [process] [output-format] [output-file]

Attempts to read provided input file as 'type' and output in requested 'output-format'.
For some 'type's it's additionally possible to process the data before outputting it.
The input type is detected from file extension ('.bin', '.hex' or '.json').

Example usage:
  @typeberry/convert ./genesis-header.json header to-hex
  @typeberry/convert ./state-snapshot.json state-dump as-entries to-json
  @typeberry/convert ./state-snapshot.json stf-vector as-fuzz-message to-bin msg0.bin

Options:
  --flavor    - chain spec flavor, either 'full' or 'tiny'.
                [default: tiny]

Output formats:
  to-print       - Print the object to the console
  to-json        - JSON format (when supported)
  to-hex         - JAM-codec hex-encoded string (when supported)
  to-bin         - JAM-codec binary data (when supported)
  to-repl        - Start a JavaScript REPL with the data loaded into a variable

Input types:
${SUPPORTED_TYPES.map((x) => `  ${x.name}`).join("\n")}

Processing: ${SUPPORTED_TYPES.filter((x) => x.process !== undefined).map(
  (x) => `
  ${x.name}:
    ${x.process?.options.join(", ")}`,
)}
`;

/** Chain spec chooser. */
export enum KnownChainSpec {
  /** Tiny chain spec. */
  Tiny = "tiny",
  /** Full chain spec. */
  Full = "full",
}

export type Arguments = {
  flavor: KnownChainSpec;
  process: string;
  type: SupportedType;
  inputPath: string;
  outputFormat: OutputFormat;
  destination: string | null;
};

export enum OutputFormat {
  Print = "to-print",
  Json = "to-json",
  Hex = "to-hex",
  Bin = "to-bin",
  Repl = "to-repl",
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
  const input = args._.shift();
  if (input === undefined) {
    throw new Error("Missing input file!");
  }
  const type = parseType(args._.shift());
  const maybeProcess = args._.shift();
  const maybeOutputFormat = args._.shift();
  const maybeDestination = args._.shift();

  assertNoMoreArgs(args);

  const { process, format, destination } = getProcessFormatAndDestination(
    type,
    maybeProcess,
    maybeOutputFormat,
    maybeDestination,
  );

  return {
    flavor: chainSpec.flavor,
    type,
    process,
    inputPath: withRelPath(input),
    outputFormat: format,
    destination,
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
    case OutputFormat.Repl:
      return OutputFormat.Repl;
    case OutputFormat.Bin:
      return OutputFormat.Bin;
    default:
      throw new Error(`Invalid output format: '${output}'.`);
  }
}

function parseProcess(processOptions: readonly string[], maybeProcess?: string): string | null {
  if (maybeProcess === undefined) {
    return null;
  }

  if (!processOptions.includes(maybeProcess)) {
    throw new Error(`Incorrect processing option: ${maybeProcess}. Expected one of: ${processOptions}.`);
  }

  return maybeProcess;
}

// TODO [ToDr] Consider sharing that?

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

function getProcessFormatAndDestination(
  type: SupportedType,
  maybeProcess: string | undefined,
  maybeOutputFormat: string | undefined,
  maybeDestination: string | undefined,
) {
  const defaultProcess = "";
  const defaultFormat = parseOutputFormat(undefined);
  const processOptions = type.process?.options ?? [];
  // we have all three so it must be in order
  if (maybeProcess !== undefined && maybeOutputFormat !== undefined && maybeDestination !== undefined) {
    const format = parseOutputFormat(maybeOutputFormat);
    const process = parseProcess(processOptions, maybeProcess) ?? defaultProcess;
    const destination = maybeDestination;
    throwIfDumpNotSupported(format, destination);

    return { process, format, destination };
  }

  // we have either:
  // 1. process + format
  // 2. format + destination
  if (maybeProcess !== undefined && maybeOutputFormat !== undefined) {
    // we've got processing first, so easy-peasy
    if (processOptions.includes(maybeProcess)) {
      const format = parseOutputFormat(maybeOutputFormat);
      throwIfDumpNotSupported(format, null);
      return { process: maybeProcess, format, destination: null };
    }
    // first one has to be format then.
    const format = parseOutputFormat(maybeProcess);
    const destination = maybeOutputFormat;
    throwIfDumpNotSupported(format, destination);

    return { process: defaultProcess, format, destination };
  }

  // only one parameter, but it can be either output or processing.
  const destination: string | null = null;
  if (maybeProcess !== undefined) {
    if (processOptions.includes(maybeProcess)) {
      return { process: maybeProcess, format: defaultFormat, destination };
    }
    // now it should be output format, but we want to give a better error message,
    // if user mispelled processing.
    try {
      const format = parseOutputFormat(maybeProcess);
      throwIfDumpNotSupported(format, destination);
      return { process: defaultProcess, format, destination };
    } catch {
      throw new Error(`'${maybeProcess}' is neither output format nor processing parameter.`);
    }
  }

  return { process: defaultProcess, format: defaultFormat, destination };
}

function throwIfDumpNotSupported(format: OutputFormat, destination: string | null) {
  if (destination !== null) {
    if (format === OutputFormat.Print || format === OutputFormat.Repl) {
      throw new Error(`Dumping to file is not supported for ${format}`);
    }
  } else {
    if (format === OutputFormat.Bin) {
      throw new Error(`${format} requires destination file`);
    }
  }
}
