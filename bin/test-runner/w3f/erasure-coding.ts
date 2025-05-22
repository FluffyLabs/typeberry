import assert from "node:assert";
import { it } from "node:test";

import { fromJson } from "@typeberry/block-json";
import { BytesBlob } from "@typeberry/bytes";
import { encodeChunks } from "@typeberry/erasure-coding/erasure-coding";
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

  const collectShard = (shards: BytesBlob[], k: number) => {
    const length = Math.ceil(shards.length / k);

    const result: BytesBlob[] = [];

    for (let i = 0; i < k; i += 1) {
      const start = i * length;
      const chunks = shards.slice(start, start + length);

      const blob = BytesBlob.blobFromParts(collect(chunks));
      result.push(blob);
    }

    return result;
  };

  const chainSpec = getChainSpec(path);

  it("should encode data", () => {
    const encoded = encodeChunks(test.data.raw);

    const shards = collectShard(
      encoded.map((chunk) => BytesBlob.blobFrom(chunk)),
      chainSpec.validatorsCount,
    );

    assert.strictEqual(shards.length, test.shards.length);
    assert.deepStrictEqual(shards[0].toString(), test.shards[0].toString());
  });

  it("should decode data", () => {});
}
