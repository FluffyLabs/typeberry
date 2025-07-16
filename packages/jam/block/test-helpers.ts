import { BytesBlob } from "@typeberry/bytes";
import { Decoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { Block } from "./block.js";
import testBlockData_0_6_4 from "./test-block-0-6-4.js";
import testBlockData from "./test-block.js";
import testWorkReportData_0_6_4 from "./test-work-report-0-6-4.js";
import testWorkReportData from "./test-work-report.js";

import { Compatibility, GpVersion } from "@typeberry/utils";

export function testBlockHex() {
  return Compatibility.isGreaterOrEqual(GpVersion.V0_6_4) ? testBlockData : testBlockData_0_6_4;
}
export function testBlock() {
  return Decoder.decodeObject(Block.Codec, BytesBlob.parseBlob(testBlockHex()), tinyChainSpec);
}

export function testBlockView() {
  return Decoder.decodeObject(Block.Codec.View, BytesBlob.parseBlob(testBlockHex()), tinyChainSpec);
}

export function testWorkReportHex() {
  return Compatibility.isGreaterOrEqual(GpVersion.V0_6_4) ? testWorkReportData : testWorkReportData_0_6_4;
}
