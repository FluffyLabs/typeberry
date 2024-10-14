import { Block } from "@typeberry/block/block";
import { json } from "@typeberry/json-parser";
import { runCodecTest } from "./common";
import { extrinsicFromJson } from "./extrinsic";
import { headerFromJson } from "./header";

export const blockFromJson = json.object<Block>(
  {
    header: headerFromJson,
    extrinsic: extrinsicFromJson,
  },
  ({ header, extrinsic }) => new Block(header, extrinsic),
);

export async function runBlockTest(test: Block, file: string) {
  runCodecTest(Block.Codec, test, file);
}
