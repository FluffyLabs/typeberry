import assert from "node:assert";
import { it } from "node:test";

import { fromJson } from "@typeberry/block-json";
import { BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { encodeChunks, reconstructData } from "@typeberry/erasure-coding/erasure-coding";
import { type FromJson, json } from "@typeberry/json-parser";
import { Logger } from "@typeberry/logger";
import { getChainSpec } from "./spec";

export class EcTest {
  static fromJson: FromJson<EcTest> = {
    data: fromJson.bytesBlob,
    shards: json.array(fromJson.bytesBlob),
  };

  data!: BytesBlob;
  shards!: BytesBlob[];
}

const logger = Logger.new(__filename, "test-runner/erasure-coding");

let seed = Math.floor(1000 * Math.random());

function random() {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

logger.info(`Erasure encoding tests random seed: ${seed}`);

export async function runEcTest(test: EcTest, path: string) {
  const chainSpec = getChainSpec(path);

  // Expands compact shards to full validator set
  function expandShardsToFullSet(chainSpec: ChainSpec, shards: BytesBlob[]): BytesBlob[] {
    if (shards.length === 1023) {
      return shards;
    }
    const shardSplitFactor = chainSpec.numberECPiecesPerSegment / 6;
    const shardLength = shards[0].length / shardSplitFactor;
    const result: BytesBlob[] = Array.from({ length: 1023 }, () => BytesBlob.blobFrom(new Uint8Array(shardLength)));
    for (let i = 0; i < shards.length; i++) {
      const shard = shards[i];
      let offset = 0;
      for (let j = 0; j < shard.length / 2; j += shardSplitFactor) {
        for (let k = 0; k < shardSplitFactor; k++) {
          const index = i * shardSplitFactor + k;
          if (index >= 1023) {
            continue; // Prevent overflow
          }
          const shardStart = (j + k) * 2;
          const shardEnd = shardStart + 2;
          result[index].raw.set(shard.raw.subarray(shardStart, shardEnd), offset);
        }
        offset += 2;
      }
    }

    return result;
  }

  function shrinkShardsToChainSpecTest(chainSpec: ChainSpec, shards: BytesBlob[]) {
    if (chainSpec.validatorsCount === 1023) {
      return shards;
    }

    return shards;
  }

  it("should encode data", () => {
    const shards = shrinkShardsToChainSpecTest(chainSpec, encodeChunks(chainSpec, test.data));

    assert.strictEqual(shards.length, test.shards.length);
    assert.deepStrictEqual(shards[0].toString(), test.shards[0].toString());
    assert.deepStrictEqual(shards[1].toString(), test.shards[1].toString());
  });

  it("should decode from first 1/3 of shards", () => {
    const shards = expandShardsToFullSet(chainSpec, test.shards).map(
      (shard, idx) => [idx, shard] as [number, BytesBlob],
    );

    const decoded = reconstructData(shards, test.data.length);

    assert.strictEqual(decoded.length, test.data.length);
    assert.deepStrictEqual(decoded.toString(), test.data.toString());
  });

  it("should decode from random 1/3 of shards", () => {
    const shards = expandShardsToFullSet(chainSpec, test.shards).map(
      (shard, idx) => [idx, shard] as [number, BytesBlob],
    );

    const selectedShards = getRandomItems(shards, 342);
    const decoded = reconstructData(selectedShards, test.data.length);

    assert.strictEqual(decoded.length, test.data.length);
    // Cannot decode from tiny testnet shards
    if (chainSpec.validatorsCount !== 6) {
      assert.deepStrictEqual(decoded.toString(), test.data.toString());
    }
  });
}

function getRandomItems(arr: [number, BytesBlob][], n: number): [number, BytesBlob][] {
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

  return result;
}
