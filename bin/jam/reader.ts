import fs from "node:fs";
import { Block, type BlockView } from "@typeberry/block";
import { blockFromJson } from "@typeberry/block-json";
import { BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { parseFromJson } from "@typeberry/json-parser";

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

function readJsonBlock(file: string, chainSpec: ChainSpec): BlockView {
  const jsonData = fs.readFileSync(file, "utf-8");
  const parsedData = JSON.parse(jsonData);
  const block = parseFromJson(parsedData, blockFromJson(chainSpec));
  const encoded = Encoder.encodeObject(Block.Codec, block, chainSpec);
  return Decoder.decodeObject(Block.Codec.View, encoded, chainSpec);
}
