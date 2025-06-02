import { it } from "node:test";

import type { PerValidator } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import type { BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray } from "@typeberry/collections";
import {
  N_SHARDS_REQUIRED,
  N_SHARDS_TOTAL,
  decodeData,
  padAndEncodeData,
  segmentsToShards,
  shardsToSegments,
} from "@typeberry/erasure-coding/erasure-coding";
import { type FromJson, json } from "@typeberry/json-parser";
import { check, deepEqual } from "@typeberry/utils";
import { getChainSpec } from "./spec";

export class EcTest {
  static fromJson: FromJson<EcTest> = {
    data: fromJson.bytesBlob,
    shards: json.array(fromJson.bytesBlob),
  };

  data!: BytesBlob;
  shards!: PerValidator<BytesBlob>;
}

export async function runEcTest(test: EcTest, path: string) {
  const spec = getChainSpec(path);
  // TODO [ToDr] For tiny we are not matching the splitting, so ignoring for now.
  const testFunc = path.includes("tiny") ? it.skip : it;

  it("should encode data & decode it back", () => {
    const shards = padAndEncodeData(test.data);
    const segments = shardsToSegments(spec, shards);
    const shardsBack = segmentsToShards(spec, segments);

    const allShards = shardsBack.flat();
    check(allShards.length >= N_SHARDS_TOTAL, "since we have data from all validators, we must have them all");
    const start = N_SHARDS_REQUIRED / 2;
    // get a bunch of shards to recover from
    const selectedShards = FixedSizeArray.new(allShards.slice(start, start + N_SHARDS_REQUIRED), N_SHARDS_REQUIRED);
    const decoded = decodeData(selectedShards);

    deepEqual(decoded, test.data);
  });

  it("should decode from the first 1/3 of shards", () => {
    const shards = segmentsToShards(spec, test.shards);
    const allShards = shards.flat();
    const selectedShards = FixedSizeArray.new(allShards.slice(0, N_SHARDS_REQUIRED), N_SHARDS_REQUIRED);
    const ourSelectedShards = (() => {
      const shards = padAndEncodeData(test.data);
      const segments = shardsToSegments(spec, shards);
      const shardsBack = segmentsToShards(spec, segments).flat();
      return FixedSizeArray.new(shardsBack.slice(0, N_SHARDS_REQUIRED), N_SHARDS_REQUIRED);
    })();
    deepEqual(selectedShards, ourSelectedShards);
    const decoded = decodeData(selectedShards);

    deepEqual(decoded, test.data);
  });

  testFunc("should exactly match the test encoding", () => {
    const shards = padAndEncodeData(test.data);
    const segments = shardsToSegments(spec, shards);

    deepEqual(segments, test.shards);
  });

  testFunc("should decode from random 1/3 of shards", () => {
    const shards = segmentsToShards(spec, test.shards);
    const allShards = shards.flat();
    const start = N_SHARDS_REQUIRED / 2;
    const selectedShards = FixedSizeArray.new(allShards.slice(start, start + N_SHARDS_REQUIRED), N_SHARDS_REQUIRED);
    const decoded = decodeData(selectedShards);

    deepEqual(decoded, test.data);
  });
}
