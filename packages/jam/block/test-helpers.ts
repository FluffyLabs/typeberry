import { BytesBlob } from "@typeberry/bytes";
import { Decoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { Block } from "./block.js";
import testBlockData from "./test-block.js";
import testWorkReportData from "./test-work-report.js";

export function testBlockHex() {
  return testBlockData;
}
export function testBlock() {
  return Decoder.decodeObject(Block.Codec, BytesBlob.parseBlob(testBlockHex()), tinyChainSpec);
}

export function testBlockView() {
  return Decoder.decodeObject(Block.Codec.View, BytesBlob.parseBlob(testBlockHex()), tinyChainSpec);
}

export function testWorkReportHex() {
  return testWorkReportData;
}
