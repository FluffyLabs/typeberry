import { BytesBlob } from "@typeberry/bytes";
import { Decoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { Block } from "./block";
import testData from "./test-block";

export function testBlock() {
  return Decoder.decodeObject(Block.Codec, BytesBlob.parseBlob(testData), tinyChainSpec);
}

export function testBlockView() {
  return Decoder.decodeObject(Block.Codec.View, BytesBlob.parseBlob(testData), tinyChainSpec);
}
