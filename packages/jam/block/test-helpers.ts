import { BytesBlob } from "@typeberry/bytes";
import { Decoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { Block } from "./block.js";
import testBlockData_0_6_5 from "./test-block-0-6-5.js";
import testBlockData from "./test-block.js";
import testWorkReportData from "./test-work-report.js";

import { Compatibility, GpVersion } from "@typeberry/utils";

export function testBlockHex() {
  if (Compatibility.isGreaterOrEqual(GpVersion.V0_7_0)) {
    return testBlockData;
  }
  return testBlockData_0_6_5;
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
