import { json } from "@typeberry/json-parser";
import { logger } from ".";
import { Extrinsic } from "./extrinsic";
import { Header } from "./header";

export class Block {
  static fromJson = json.object<Block>(
    {
      header: Header.fromJson,
      extrinsic: Extrinsic.fromJson,
    },
    (b) => Object.assign(new Block(), b),
  );

  header!: Header;
  extrinsic!: Extrinsic;

  private constructor() {}
}

export async function runBlockTest(test: Block, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
