import type { Header } from "@typeberry/block";
import { json } from "@typeberry/json-parser";
import { logger } from ".";
import { Extrinsic } from "./extrinsic";
import { headerFromJson } from "./header";

export class Block {
  static fromJson = json.object<Block>(
    {
      header: headerFromJson,
      extrinsic: Extrinsic.fromJson,
    },
    (b) => new Block(b.header, b.extrinsic),
  );

  public constructor(
    public header: Header,
    public extrinsic: Extrinsic,
  ) {}
}

export async function runBlockTest(test: Block, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
