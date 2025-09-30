// biome-ignore-all lint/suspicious/noConsole: bin file

import "json-bigint-patch";
import fs from "node:fs";
import { start as startRepl } from "node:repl";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder, ObjectView } from "@typeberry/codec";
import { HashDictionary } from "@typeberry/collections";
import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { Blake2b } from "@typeberry/hash";
import { parseFromJson } from "@typeberry/json-parser";
import { assertNever, inspect } from "@typeberry/utils";
import { type Arguments, KnownChainSpec, OutputFormat } from "./args.js";
import type { SupportedType } from "./types.js";

export async function main(args: Arguments, withRelPath: (v: string) => string) {
  const { processed, type, spec } = await loadAndProcessDataFile(
    args.inputPath,
    withRelPath,
    args.flavor,
    args.type,
    args.process,
  );
  dumpOutput(spec, processed, type, args.outputFormat, args, withRelPath);
  return;
}

function getChainSpec(chainSpec: KnownChainSpec) {
  if (chainSpec === KnownChainSpec.Full) {
    return fullChainSpec;
  }
  if (chainSpec === KnownChainSpec.Tiny) {
    return tinyChainSpec;
  }
  assertNever(chainSpec);
}

function loadInputFile(
  file: string | undefined,
  withRelPath: (v: string) => string,
):
  | {
      type: "blob";
      data: BytesBlob;
    }
  | {
      type: "json";
      data: unknown;
    } {
  if (file === undefined) {
    throw new Error("Missing input file!");
  }

  if (file.endsWith(".bin")) {
    const fileContent = fs.readFileSync(withRelPath(file));

    return {
      type: "blob",
      data: BytesBlob.blobFrom(fileContent),
    };
  }

  const fileContent = fs.readFileSync(withRelPath(file), "utf8").trim();
  if (file.endsWith(".hex")) {
    return {
      type: "blob",
      data: BytesBlob.parseBlob(fileContent),
    };
  }

  if (file.endsWith(".json")) {
    return {
      type: "json",
      data: JSON.parse(fileContent),
    };
  }

  throw new Error("Input file format unsupported.");
}

function dumpOutput(
  spec: ChainSpec,
  data: unknown,
  type: SupportedType,
  outputFormat: OutputFormat,
  args: Arguments,
  withRelPath: (path: string) => string,
) {
  const { destination } = args;
  const dump =
    destination !== null
      ? (v: string | Uint8Array) => fs.writeFileSync(withRelPath(destination), v)
      : (v: string | Uint8Array) => console.info(v);

  switch (outputFormat) {
    case OutputFormat.Print: {
      dump(`${inspect(data)}`);
      return;
    }
    case OutputFormat.Hex: {
      if (type.encode === undefined) {
        throw new Error(`${type.name} does not support encoding to JAM codec.`);
      }
      const encoded = Encoder.encodeObject(type.encode, data, spec);
      dump(`${encoded}`);
      return;
    }
    case OutputFormat.Bin: {
      if (type.encode === undefined) {
        throw new Error(`${type.name} does not support encoding to JAM codec.`);
      }
      if (destination === null) {
        throw new Error(`${OutputFormat.Bin} requires destination file.`);
      }
      const encoded = Encoder.encodeObject(type.encode, data, spec);
      dump(encoded.raw);
      return;
    }
    case OutputFormat.Json: {
      // TODO [ToDr] this will probably not work for all cases,
      // but for now may be good enough.
      dump(toJson(data));
      return;
    }
    case OutputFormat.Repl: {
      console.info("\nStarting JavaScript REPL with converted data...");
      console.info("📦 Data type:", type.name);
      console.info("💡 Your data is available in the 'data' variable");
      console.info("🔍 Try: data, inspect(data), toJson(data)");
      console.info("❓ Type .help for REPL commands or .exit to quit\n");

      const replServer = startRepl({
        prompt: `${type.name}> `,
        useColors: true,
      });

      replServer.defineCommand("load", {
        help: "Reload the input file and updata data: .load <file> [process]",
        async action(input: string) {
          const [file, process] = input.trim().split(/\s+/);
          const processOption = process ?? args.process;
          if (file === "") {
            console.error("❌ No file specified");
            this.displayPrompt();
            return;
          }
          try {
            const { processed } = await loadAndProcessDataFile(
              file,
              withRelPath,
              args.flavor,
              args.type,
              processOption,
            );
            replServer.context.data = processed;
            console.info("✅ File reloaded successfully!");
            console.info("📁 Current file:", file);
            if (processOption !== undefined) {
              console.info("⚙️ Process:", processOption);
            }
          } catch (error) {
            console.error("❌ Error reloading file:", error);
          }

          this.displayPrompt();
        },
      });

      reset();
      replServer.on("reset", reset);

      function reset() {
        // Make the data available in the REPL context
        replServer.context.data = data;

        // Add utility functions to the context
        replServer.context.inspect = inspect;
        replServer.context.type = type;
        replServer.context.toJson = toJson;
        replServer.context.Bytes = Bytes;
        replServer.context.BytesBlob = BytesBlob;
      }

      return;
    }
    default:
      assertNever(outputFormat);
  }
}

function toJson(data: unknown) {
  return JSON.stringify(
    data,
    (_key, value) => {
      if (value instanceof BytesBlob) {
        return value.toString();
      }

      if (value instanceof HashDictionary) {
        return Object.fromEntries(Array.from(value).map(([key, val]) => [key.toString(), val]));
      }

      if (value instanceof Map) {
        return Object.fromEntries(value.entries());
      }

      if (value instanceof ObjectView) {
        return value.materialize();
      }

      return value;
    },
    2,
  );
}

function processOutput(
  spec: ChainSpec,
  blake2b: Blake2b,
  data: unknown,
  type: SupportedType,
  process: string,
): {
  processed: unknown;
  type: SupportedType;
} {
  if (process === "") {
    return { processed: data, type };
  }

  if (type.process === undefined || !type.process.options.includes(process)) {
    throw new Error(`Unsupported processing: '${process}' for '${type.name}'`);
  }
  const processed = type.process.run(spec, data, process, blake2b);
  return {
    processed: processed.value,
    type: {
      ...type,
      name: `${type.name}(${process})`,
      // use encoding from processed type
      encode: processed.encode,
    },
  };
}

async function loadAndProcessDataFile(
  file: string | undefined,
  withRelPath: (v: string) => string,
  flavor: KnownChainSpec,
  decodeType: SupportedType,
  process: string,
) {
  const blake2b = Blake2b.createHasher();
  const input = loadInputFile(file, withRelPath);
  const spec = getChainSpec(flavor);

  let data: unknown;

  if (input.type === "blob") {
    if (decodeType.decode === undefined) {
      throw new Error(`${decodeType.name} does not support decoding from binary data.`);
    }
    data = Decoder.decodeObject(decodeType.decode, input.data, spec);
  } else if (input.type === "json") {
    if (decodeType.json === undefined) {
      throw new Error(`${decodeType.name} does not support reading from JSON.`);
    }
    data = parseFromJson(input.data, decodeType.json(spec));
  } else {
    assertNever(input);
  }

  const { processed, type } = processOutput(spec, await blake2b, data, decodeType, process);

  return {
    processed,
    type,
    spec,
  };
}
