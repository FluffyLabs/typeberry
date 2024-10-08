import assert from "node:assert";
import { it } from "node:test";

import { BytesBlob } from "@typeberry/bytes";
import { decodeData, encodeData } from "@typeberry/erasure-coding";
import { type FromJson, json } from "@typeberry/json-parser";
import { Logger } from "@typeberry/logger";

namespace fromJson {
  export const bytesBlob = json.fromString(BytesBlob.parseBlobNoPrefix);
}

export class EcTest {
  static fromJson: FromJson<EcTest> = {
    data: fromJson.bytesBlob,
    chunks: json.array(fromJson.bytesBlob),
  };

  data!: BytesBlob;
  chunks!: BytesBlob[];
}

export class PageProof {
  static fromJson: FromJson<PageProof> = {
    data: fromJson.bytesBlob,
    page_proofs: json.array(fromJson.bytesBlob),
    segments_root: fromJson.bytesBlob,
  };

  data!: BytesBlob;
  page_proofs!: BytesBlob[];
  segments_root!: BytesBlob;
}

export class SegmentEc {
  static fromJson: FromJson<SegmentEc> = {
    segment_ec: json.array(fromJson.bytesBlob),
  };

  segment_ec!: BytesBlob[];
}

export class SegmentEcTest {
  static fromJson: FromJson<SegmentEcTest> = {
    data: fromJson.bytesBlob,
    segments: json.array(SegmentEc.fromJson),
    segments_root: fromJson.bytesBlob,
  };

  data!: BytesBlob;
  segments!: SegmentEc[];
  segments_root!: BytesBlob;
}

export class SegmentRoot {
  static fromJson: FromJson<SegmentRoot> = {
    data: fromJson.bytesBlob,
    chunks: json.array(fromJson.bytesBlob),
    chunks_root: fromJson.bytesBlob,
  };

  data!: BytesBlob;
  chunks!: BytesBlob[];
  chunks_root!: BytesBlob;
}

const logger = Logger.new(__filename, "test-runner/erasure-coding");

export async function runEcTest(test: EcTest) {
  if (test.chunks[0].length > 2) {
    logger.info("Incorrect test data. The chunks should have 2 bytes!");
    it.skip(`test was skipped because of incorrect data: chunk length: ${test.chunks[0].length} (it should be 2)`);
    return;
  }

  it("should encode data", () => {
    const encoded = encodeData(test.data.buffer);
    // slice(0, 1023) is needed becuase test data is incorrect (1026 length)
    const expected = test.chunks.slice(0, 1023).map((x) => x.buffer);

    assert.deepStrictEqual(encoded, expected);
  });

  it("should decode data", () => {
    // slice(0, 1023) is needed becuase test data is incorrect (1026 length)
    const chunks = test.chunks.slice(0, 1023).map((chunk, idx) => [idx, chunk.buffer] as [number, Uint8Array]);
    const selectedChunks = getRandomItems(chunks, 342);

    const decoded = decodeData(selectedChunks, test.data.buffer.length);

    assert.deepStrictEqual(decoded, test.data.buffer);
  });
}

export async function runPageProofTest(test: PageProof) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error("Not implemented yet!");
}

export async function runSegmentEcTest(test: SegmentEcTest) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error("Not implemented yet!");
}

export async function runSegmentRootTest(test: SegmentRoot) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error("Not implemented yet!");
}

function getRandomItems(arr: [number, Uint8Array][], n: number): [number, Uint8Array][] {
  if (n > arr.length) {
    throw new Error("Requested more items than available in the array");
  }

  const result: [number, Uint8Array][] = [];
  const copy = [...arr];

  for (let i = 0; i < n; i++) {
    const randomIndex = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[randomIndex]] = [copy[randomIndex], copy[i]];
    result.push(copy[i]);
  }

  return result;
}
