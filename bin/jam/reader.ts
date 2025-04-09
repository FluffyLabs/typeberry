import fs from "node:fs";
import { Block, type BlockView } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { Decoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";

export type BlocksImporterConfig = {
  /**
   * Import blocks from a set of files (JSON vs bin - autodetected).
   *
   * The files containing blocks need to be ordered by the importing order.
   */
  files: string[];
  /** chainspec config */
  chainSpec: ChainSpec;
};

export function* startBlocksReader(options: BlocksImporterConfig) {
  const { chainSpec } = options;
  for (const file of options.files) {
    const isJsonFile = isJson(file);

    const block = isJsonFile ? readJsonBlock(file, chainSpec) : readCodecBlock(file, chainSpec);
    yield block;
  }
}

const isJson = (f: string) => f.endsWith(".json");

function readCodecBlock(file: string, chainSpec: ChainSpec): BlockView {
  const codecData = fs.readFileSync(file);
  const bytes = BytesBlob.blobFrom(new Uint8Array(codecData));
  return Decoder.decodeObject(Block.Codec.View, bytes, chainSpec);
}

function readJsonBlock(file: string, _chainSpec: ChainSpec): BlockView {
  const jsonData = fs.readFileSync(file, "utf-8");
  const _parsedData = JSON.parse(jsonData);
  // parse JSON data.
  // parseFromJson(JSON.parse(jsonData), blockFromJson);
  throw new Error("not implemented yet");
}
