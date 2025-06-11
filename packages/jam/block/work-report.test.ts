import assert from "node:assert";
import { describe, it } from "node:test";
import { Encoder } from "@typeberry/codec";
import { tryAsU32 } from "@typeberry/numbers";
import { tryAsServiceGas } from "./common.js";
import { WorkRefineLoad } from "./work-result.js";

describe("WorkReport", () => {
  it("should encode work refine load", () => {
    const load = WorkRefineLoad.create({
      gasUsed: tryAsServiceGas(0),
      importedSegments: tryAsU32(0),
      exportedSegments: tryAsU32(0),
      extrinsicCount: tryAsU32(0),
      extrinsicSize: tryAsU32(0),
    });

    const encoded = Encoder.encodeObject(WorkRefineLoad.Codec, load);
    assert.deepStrictEqual(encoded.toString(), "0x0000000000");
  });
});
