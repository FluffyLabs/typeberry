import { it } from "node:test";

import { fromJson } from "@typeberry/block-json";
import type { BytesBlob } from "@typeberry/bytes";
import {
  decodeData,
  N_SHARDS_REQUIRED,
  padAndEncodeData,
  segmentsToShards,
  shardsToSegments,
} from "@typeberry/erasure-coding/erasure-coding";
import { type FromJson, json } from "@typeberry/json-parser";
import { Logger } from "@typeberry/logger";
import { getChainSpec } from "./spec";
import {deepEqual} from "@typeberry/utils";
import {PerValidator} from "@typeberry/block";
import {FixedSizeArray} from "@typeberry/collections";

export class EcTest {
  static fromJson: FromJson<EcTest> = {
    data: fromJson.bytesBlob,
    shards: json.array(fromJson.bytesBlob),
  };

  data!: BytesBlob;
  shards!: PerValidator<BytesBlob>;
}

const logger = Logger.new(__filename, "test-runner/erasure-coding");

let seed = Math.floor(1000 * Math.random());

function random() {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

logger.info(`Erasure encoding tests random seed: ${seed}`);

export async function runEcTest(test: EcTest, path: string) {
  const spec = getChainSpec(path);

  it("should encode data", () => {
    const shards = padAndEncodeData(test.data);
    console.log('Our shards', `${shards}`);
    console.log('Their', `${test.shards}`);
    const segments = shardsToSegments(spec, shards);

    // deepEqual(segments, test.shards);
  });

  it.skip("should decode from first 1/3 of shards", () => {
    const shards = segmentsToShards(spec, test.shards);
    const allShards = shards.flatMap(x => x);
    const decoded = decodeData(FixedSizeArray.new(
      allShards.slice(0, N_SHARDS_REQUIRED),
      N_SHARDS_REQUIRED
    ));

    deepEqual(decoded, test.data);
  });

  it.skip("should decode from random 1/3 of shards", () => {
    const shards = segmentsToShards(spec, test.shards);
    const allShards = shards.flatMap(x => x);
    const selectedShards = getRandomItems(allShards, N_SHARDS_REQUIRED);
    const decoded = decodeData(selectedShards);

    deepEqual(decoded, test.data);
  });
}

function getRandomItems<N extends number>(
  arr: [number, BytesBlob][],
  n: N
): FixedSizeArray<[number, BytesBlob], N> {
  if (n > arr.length) {
    throw new Error("Requested more items than available in the array");
  }

  const result: [number, BytesBlob][] = [];
  const copy = [...arr];

  for (let i = 0; i < n; i++) {
    const randomIndex = i + Math.floor(random() * (copy.length - i));
    [copy[i], copy[randomIndex]] = [copy[randomIndex], copy[i]];
    result.push(copy[i]);
  }

  return FixedSizeArray.new(result, n);
}
