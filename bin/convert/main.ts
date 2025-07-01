import fs from "node:fs";
import { BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { parseFromJson } from "@typeberry/json-parser";
import { assertNever, inspect } from "@typeberry/utils";
import { type Arguments, KnownChainSpec, OutputFormat } from "./args.js";
import type { SupportedType } from "./types.js";

export function main(args: Arguments, withRelPath: (v: string) => string) {
  const input = loadInputFile(args.inputPath, withRelPath);
  const spec = getChainSpec(args.flavor);

  const dump = (data: unknown) => {
    dumpOutput(spec, data, args.type, args.outputFormat);
  };

  if (input.type === "blob") {
    if (args.type.decode === undefined) {
      throw new Error(`${args.type.name} does not support decoding from binary data.`);
    }
    const data = Decoder.decodeObject(args.type.decode, input.data, spec);
    dump(data);
    return;
  }

  if (input.type === "json") {
    if (args.type.json === undefined) {
      throw new Error(`${args.type.name} does not support reading from JSON.`);
    }
    const parsed = parseFromJson(input.data, args.type.json(spec));
    dump(parsed);
    return;
  }

  assertNever(input);
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
  const fileContent = fs.readFileSync(withRelPath(file), "utf8");
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
function dumpOutput(spec: ChainSpec, data: unknown, type: SupportedType, outputFormat: OutputFormat) {
  switch (outputFormat) {
    case OutputFormat.Print: {
      console.info(`${inspect(data)}`);
      return;
    }
    case OutputFormat.Hex: {
      if (type.encode === undefined) {
        throw new Error(`${type.name} does not support encoding to JAM codec.`);
      }
      const encoded = Encoder.encodeObject(type.encode, data, spec);
      console.info(`${encoded}`);
      return;
    }
    case OutputFormat.Json: {
      // TODO [ToDr] this will probably not work for all cases,
      // but for now may be good enough.
      console.info(
        JSON.stringify(
          data,
          (_key, value) => {
            if (value instanceof BytesBlob) {
              return value.toString();
            }
            if (typeof value === "bigint") {
              return value.toString();
            }
            return value;
          },
          2,
        ),
      );
      return;
    }
    default:
      assertNever(outputFormat);
  }
}
