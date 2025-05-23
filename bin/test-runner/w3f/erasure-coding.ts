import assert from "node:assert";
import { it } from "node:test";

import { fromJson } from "@typeberry/block-json";
import { BytesBlob } from "@typeberry/bytes";
import { encodeChunks, reconstructData } from "@typeberry/erasure-coding/erasure-coding";
import { type FromJson, json } from "@typeberry/json-parser";
import { Logger } from "@typeberry/logger";
import { check } from "@typeberry/utils";
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
  /** transposing and joining in one go */
  const collect = (shards: BytesBlob[]) => {
    if (shards.length === 0) {
      return new Uint8Array(0);
    }
    const shardLength = shards[0].length;
    const result = new Uint8Array(shards.length * shardLength);
    let offset = 0;
    for (let seg = 0; seg < shardLength; seg += 2) {
      for (let i = 0; i < shards.length; i++) {
        result.set(shards[i].raw.slice(seg, seg + 2), offset);
        offset += 2;
      }
    }
    return result;
  };

  /** helper to support TINY specs */
  const collectShard = (shards: BytesBlob[], validators: number) => {
    const length = Math.ceil(shards.length / validators);

    const result: BytesBlob[] = [];

    for (let i = 0; i < validators; i++) {
      const start = i * length;
      const chunks = shards.slice(start, start + length);

      const blob = BytesBlob.blobFromParts(collect(chunks));
      result.push(blob);
    }

    return result;
  };

  /** spiting and transposing in one go */
  const decouple = (collectedData: BytesBlob, numOriginalShards: number) => {
    const originalShardLength = collectedData.length / numOriginalShards;
    const reconstructedShardsData: BytesBlob[] = [];
    for (let i = 0; i < numOriginalShards; i++) {
      reconstructedShardsData.push(BytesBlob.empty({ size: originalShardLength }));
    }

    let readOffset = 0;
    for (let seg = 0; seg < originalShardLength; seg += 2) {
      for (let i = 0; i < numOriginalShards; i++) {
        const bytesToReadForThisSegment = Math.min(2, originalShardLength - seg);

        if (readOffset + bytesToReadForThisSegment > collectedData.length) {
          continue;
        }
        const segmentFromCollected = collectedData.raw.subarray(readOffset, readOffset + bytesToReadForThisSegment);
        reconstructedShardsData[i].raw.set(segmentFromCollected, seg);
        readOffset += 2;
      }
    }
    return reconstructedShardsData;
  };

  const splitShard = (shards: BytesBlob[], validators: number) => {
    const shardsPerGroup = Math.ceil(1023 / validators);
    const allReconstructedShards: BytesBlob[] = [];

    for (let i = 0; i < validators; i++) {
      const currentCollectedBlobRaw = shards[i];

      const distributedShardsFromGroup = decouple(currentCollectedBlobRaw, shardsPerGroup);
      allReconstructedShards.push(...distributedShardsFromGroup);
    }

    check(allReconstructedShards.length > 342, "Not enough shards");
    return allReconstructedShards;
  };

  const chainSpec = getChainSpec(path);

  it("should encode data", () => {
    const encoded = encodeChunks(test.data);

    const shards = collectShard(encoded, chainSpec.validatorsCount);

    assert.strictEqual(shards.length, test.shards.length);
    assert.deepStrictEqual(shards[0].toString(), test.shards[0].toString());
  });

  it("should decode data", () => {
    const split = splitShard(test.shards, chainSpec.validatorsCount);

    const shards = split.map((shard, idx) => [idx, shard] as [number, BytesBlob]);

    const decoded = reconstructData(shards, test.data.length);

    assert.strictEqual(decoded.length, test.data.length);
    assert.deepStrictEqual(decoded.toString(), test.data.toString());
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
