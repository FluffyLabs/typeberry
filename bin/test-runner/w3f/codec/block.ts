import { Block } from "@typeberry/block/block";
import { tinyChainSpec } from "@typeberry/config";
import { json } from "@typeberry/json-parser";
import { logger } from "../../common";
import { runCodecTest } from "./common";
import { getExtrinsicFromJson } from "./extrinsic";
import { headerFromJson } from "./header";

export const blockFromJson = json.object<Block>(
  {
    header: headerFromJson,
    extrinsic: getExtrinsicFromJson(tinyChainSpec),
  },
  ({ header, extrinsic }) => new Block(header, extrinsic),
);

export async function runBlockTest(test: Block, file: string) {
  logger.log(`BlockTest { ${test}, ${file} }`);
  runCodecTest(Block.Codec, test, file);
}
