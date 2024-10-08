import assert from "node:assert";
import fs from "node:fs";
import { Block } from "@typeberry/block/block";
import { Decoder } from "@typeberry/codec";
import { json } from "@typeberry/json-parser";
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
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));
  const decoded = Decoder.decodeObject(Block.Codec, encoded);

  assert.deepStrictEqual(decoded, test);
}
