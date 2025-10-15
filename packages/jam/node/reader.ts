import fs from "node:fs";
import { Block, type BlockView } from "@typeberry/block";
import { blockFromJson } from "@typeberry/block-json";
import { Decoder, Encoder, EndOfDataError } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { parseFromJson } from "@typeberry/json-parser";
import { Logger } from "@typeberry/logger";
import { resultToString } from "@typeberry/utils";
import type { NodeApi } from "./main.js";

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

export const importBlocks = async (node: NodeApi, blocksToImport: string[]) => {
  const logger = Logger.new(import.meta.filename, "jam");

  logger.info`📖 Reading blocks from ${blocksToImport.length} files`;

  const reader = startBlocksReader(
    {
      files: blocksToImport,
      chainSpec: node.chainSpec,
    },
    logger,
  );
  for (const block of reader) {
    logger.log`📖 Importing block: #${block.header.view().timeSlotIndex.materialize()}`;
    const res = await node.importBlock(block);
    if (res.isError) {
      logger.error`📖 ${resultToString(res)}`;
    }
  }
  // close the importer.
  logger.info`All blocks scheduled to be imported.`;
  return await node.close();
};

export function* startBlocksReader(options: BlocksImporterConfig, logger: Logger) {
  const { chainSpec } = options;
  for (const file of options.files) {
    const isJsonFile = isJson(file);

    logger.log`📖 Reading ${file}...`;

    if (isJsonFile) {
      yield readJsonBlock(file, chainSpec);
    } else {
      yield* readCodecBlocks(file, chainSpec);
    }
  }
}

const isJson = (f: string) => f.endsWith(".json");

function* readCodecBlocks(file: string, chainSpec: ChainSpec): Generator<BlockView> {
  const fileDescriptor = fs.openSync(file, "r");
  const bufferSize = 1024 * 1024; // should be at least max block length
  const buffer = new Uint8Array(bufferSize);
  let offset = 0;
  let bytesRead = 0;
  const getNextChunk = () => {
    try {
      bytesRead = fs.readSync(fileDescriptor, buffer, offset, bufferSize, null);
    } catch (_) {
      return false;
    }
    offset += bufferSize;
    return true;
  };
  while (getNextChunk()) {
    const decoder = Decoder.fromBlob(buffer.slice(0, bytesRead), chainSpec);

    try {
      while (true) {
        yield decoder.object(Block.Codec.View);
      }
    } catch (e) {
      if (!(e instanceof EndOfDataError)) {
        throw e;
      }
    }

    offset -= bufferSize - decoder.bytesRead();
  }
}

function readJsonBlock(file: string, chainSpec: ChainSpec): BlockView {
  const jsonData = fs.readFileSync(file, "utf-8");
  const parsedData = JSON.parse(jsonData);
  const blockData = "block" in parsedData ? parsedData.block : parsedData;
  const block = parseFromJson(blockData, blockFromJson(chainSpec));
  const encoded = Encoder.encodeObject(Block.Codec, block, chainSpec);
  return Decoder.decodeObject(Block.Codec.View, encoded, chainSpec);
}
