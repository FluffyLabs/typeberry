import assert from "node:assert";
import { it } from "node:test";

import { fromJson } from "@typeberry/block-json";
import type { BytesBlob } from "@typeberry/bytes";
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

  it("should encode data", () => {
    const shards = encodeChunks(test.data, chainSpec);

    // console.log(`Encoded data length: ${test.data.length}`);
    // console.log(`Encoded shards length: ${shards.length}`);
    // console.log("{");
    // for (let i = 0; i < shards.length; i++) {
    //   console.log(`Shard: ${i},\nlength: ${shards[i].length},`);
    //   console.log(`data: ${shards[i].toString()},`);
    // }
    // console.log("}");

    assert.strictEqual(shards.length, test.shards.length);
    assert.deepStrictEqual(shards[0].toString(), test.shards[0].toString());
    assert.deepStrictEqual(shards[1].toString(), test.shards[1].toString());
  });

  it("should decode from first 1/3 of shards", () => {
    const shards = test.shards.map((shard, idx) => [idx, shard] as [number, BytesBlob]);

    // console.log("{");
    // console.log(`Selected shards: \n${shards.map(([idx, shard]) => `Shard: ${idx},\ndata: ${shard.toString()}\n`)}`);
    // console.log("}");
    const decoded = reconstructData(shards, chainSpec, test.data.length);

    // console.log(`Decoded data length: ${decoded.length},`);
    // console.log("{");
    // console.log(`Decoded_data: ${decoded.toString()},`);
    // console.log("}");

    assert.strictEqual(decoded.length, test.data.length);
    assert.deepStrictEqual(decoded.toString(), test.data.toString());
  });

  it("should decode from random 1/3 of shards", () => {
    const randomShards = chainSpec.validatorsCount === 6 ? 2 : 342;
    const shards = test.shards.map((shard, idx) => [idx, shard] as [number, BytesBlob]);

    const selectedShards = getRandomItems(shards, randomShards);
    // logger.info(`Randomly selecting ${randomShards} shards from ${shards.length} total shards`);
    // console.log("{");
    // console.log(
    //   `Selected_shards: \n${selectedShards.map(([idx, shard]) => `Shard: ${idx},\ndata: ${shard.toString()},\n`)}`,
    // );
    // console.log("}");

    const decoded = reconstructData(selectedShards, chainSpec, test.data.length);

    // console.log(`Decoded data length: ${decoded.length},`);
    // console.log("{");
    // console.log(`Decoded_data: ${decoded.toString()},`);
    // console.log("}");

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
