import type { FromJson } from "@typeberry/json-parser";
import { logger } from ".";
import { Extrinsic } from "./extrinsic";
import { Header } from "./header";

export class Block {
  static fromJson: FromJson<Block> = {
    header: Header.fromJson,
    extrinsic: Extrinsic.fromJson,
  };

  header!: Header;
  extrinsic!: Extrinsic;

  private constructor() {}
}

export async function runBlockTest(test: Block, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
