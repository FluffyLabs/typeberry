import { it } from "node:test";

import type { PerValidator } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import type { BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray } from "@typeberry/collections";
import {
  N_CHUNKS_REQUIRED,
  N_CHUNKS_TOTAL,
  chunksToShards,
  decodeDataAndTrim,
  padAndEncodeData,
  shardsToChunks,
} from "@typeberry/erasure-coding";
import { type FromJson, json } from "@typeberry/json-parser";
import { check, deepEqual } from "@typeberry/utils";
import { getChainSpec } from "./spec.js";

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

  it("should encode data & decode it back", () => {
    const shards = padAndEncodeData(test.data);
    const segments = chunksToShards(spec, shards);
    const shardsBack = shardsToChunks(spec, segments);

    const allShards = shardsBack.flat();
    check(allShards.length >= N_CHUNKS_TOTAL, "since we have data from all validators, we must have them all");
    const start = N_CHUNKS_REQUIRED / 2;
    // get a bunch of shards to recover from
    const selectedShards = FixedSizeArray.new(allShards.slice(start, start + N_CHUNKS_REQUIRED), N_CHUNKS_REQUIRED);
    const decoded = decodeDataAndTrim(selectedShards, test.data.length);

    deepEqual(decoded, test.data);
  });

  it("should decode from the first 1/3 of shards", () => {
    const shards = shardsToChunks(spec, test.shards);
    const allShards = shards.flat();
    const selectedShards = FixedSizeArray.new(allShards.slice(0, N_CHUNKS_REQUIRED), N_CHUNKS_REQUIRED);
    const ourSelectedShards = (() => {
      const shards = padAndEncodeData(test.data);
      const segments = chunksToShards(spec, shards);
      const shardsBack = shardsToChunks(spec, segments).flat();
      return FixedSizeArray.new(shardsBack.slice(0, N_CHUNKS_REQUIRED), N_CHUNKS_REQUIRED);
    })();
    deepEqual(selectedShards, ourSelectedShards);
    const decoded = decodeDataAndTrim(selectedShards, test.data.length);

    deepEqual(decoded, test.data);
  });

  it("should exactly match the test encoding", () => {
    const shards = padAndEncodeData(test.data);
    const segments = chunksToShards(spec, shards);

    deepEqual(segments, test.shards);
  });

  it("should decode from random 1/3 of shards", () => {
    const shards = shardsToChunks(spec, test.shards);
    const allShards = shards.flat();
    const start = N_CHUNKS_REQUIRED / 2;
    const selectedShards = FixedSizeArray.new(allShards.slice(start, start + N_CHUNKS_REQUIRED), N_CHUNKS_REQUIRED);
    const decoded = decodeDataAndTrim(selectedShards, test.data.length);

    deepEqual(decoded, test.data);
  });
}
