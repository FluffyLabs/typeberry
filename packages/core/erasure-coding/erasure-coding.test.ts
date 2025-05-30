import assert from "node:assert";
import { describe, it } from "node:test";
import { BytesBlob } from "@typeberry/bytes";
import { tinyChainSpec } from "@typeberry/config/chain-spec";
import { SEGMENT_FULL, SEGMENT_TINY, TEST_DATA, WORKPACKAGE_FULL, WORKPACKAGE_TINY } from "./ec-test-data";
import {
  condenseShardsFromFullSet,
  decodeData,
  encodeChunks,
  encodeData,
  expandShardsToFullSet,
  join,
  lace,
  reconstructData,
  split,
  unzip,
} from "./erasure-coding";

let seed = 1;
function random() {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function getRandomItems<T>(arr: [number, T][], n: number): [number, T][] {
  if (n > arr.length) {
    throw new Error("Requested more items than available in the array");
  }

  const result: [number, T][] = [];
  const copy = [...arr];

  for (let i = 0; i < n; i++) {
    const randomIndex = i + Math.floor(random() * (copy.length - i));
    [copy[i], copy[randomIndex]] = [copy[randomIndex], copy[i]];
    result.push(copy[i]);
  }

  return result;
}

describe("erasure coding: general", () => {
  const data = TEST_DATA.data as string;
  const segmentEc = TEST_DATA.segment.segments[0].segment_ec;

  seed = Math.floor(1000 * Math.random());

  it("should encode data", () => {
    const encoded = encodeData(BytesBlob.parseBlobNoPrefix(data).raw);
    const expected = segmentEc.map(BytesBlob.parseBlobNoPrefix).map((x) => x.raw);

    assert.deepStrictEqual(encoded.length, expected.length);
    assert.deepStrictEqual(encoded, expected);
  });

  it(`should decode data (random seed: ${seed})`, () => {
    const chunks = segmentEc.map((chunk, idx) => [idx, BytesBlob.parseBlobNoPrefix(chunk).raw] as [number, Uint8Array]);
    const selectedChunks = getRandomItems(chunks, 342);

    const decoded = decodeData(selectedChunks);
    const resultAsString = Array.from(decoded)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    assert.deepStrictEqual(resultAsString, data);
  });
});

describe("erasure coding: full", () => {
  const wp_data = WORKPACKAGE_FULL.data as string;
  const wp_shards = WORKPACKAGE_FULL.shards;
  const seg_data = SEGMENT_FULL.data as string;
  const seg_shards = SEGMENT_FULL.shards;

  seed = Math.floor(1000 * Math.random());

  it("should encode segment data", () => {
    const encoded = encodeChunks(BytesBlob.parseBlobNoPrefix(seg_data));
    const expected = seg_shards.map(BytesBlob.parseBlobNoPrefix);

    assert.deepStrictEqual(encoded.length, expected.length);
    assert.deepStrictEqual(encoded, expected);
  });

  it(`should decode segment data (random seed: ${seed})`, () => {
    const chunks = seg_shards.map((chunk, idx) => [idx, BytesBlob.parseBlobNoPrefix(chunk)] as [number, BytesBlob]);
    const selectedChunks = getRandomItems(chunks, 342);

    const decoded = reconstructData(selectedChunks, seg_data.length);

    assert.deepStrictEqual(decoded.toString().slice(2, seg_data.length + 2), seg_data);
  });

  it("should encode workpackage data", () => {
    const encoded = encodeChunks(BytesBlob.parseBlobNoPrefix(wp_data));
    const expected = wp_shards.map(BytesBlob.parseBlobNoPrefix);

    assert.deepStrictEqual(encoded.length, expected.length);
    assert.deepStrictEqual(encoded, expected);
  });

  it(`should decode workpackage data (random seed: ${seed})`, () => {
    const chunks = wp_shards.map((chunk, idx) => [idx, BytesBlob.parseBlobNoPrefix(chunk)] as [number, BytesBlob]);
    const selectedChunks = getRandomItems(chunks, 342);

    const decoded = reconstructData(selectedChunks, wp_data.length);

    assert.deepStrictEqual(decoded.toString().slice(2, wp_data.length + 2), wp_data);
  });

  it(`should encode and decode segment data without a change (random seed: ${seed})`, () => {
    const encoded = encodeChunks(BytesBlob.parseBlobNoPrefix(seg_data));
    const selectedChunks = getRandomItems(
      encoded.map((chunk, idx) => [idx, chunk] as [number, BytesBlob]),
      342,
    );
    const decoded = reconstructData(selectedChunks, seg_data.length);

    assert.deepStrictEqual(decoded.toString().slice(2, seg_data.length + 2), seg_data);
  });

  it(`should encode and decode workpackage data without a change (random seed: ${seed})`, () => {
    const encoded = encodeChunks(BytesBlob.parseBlobNoPrefix(wp_data));
    const selectedChunks = getRandomItems(
      encoded.map((chunk, idx) => [idx, chunk] as [number, BytesBlob]),
      342,
    );
    const decoded = reconstructData(selectedChunks, wp_data.length);

    assert.deepStrictEqual(decoded.toString().slice(2, wp_data.length + 2), wp_data);
  });
});

describe("erasure coding: tiny", () => {
  const wp_data = WORKPACKAGE_TINY.data as string;
  const wp_shards = WORKPACKAGE_TINY.shards;
  const seg_data = SEGMENT_TINY.data as string;
  const seg_shards = SEGMENT_TINY.shards;

  seed = Math.floor(1000 * Math.random());

  it("should encode segment data", () => {
    const encoded = condenseShardsFromFullSet(tinyChainSpec, encodeChunks(BytesBlob.parseBlobNoPrefix(seg_data)));
    const expected = seg_shards.map(BytesBlob.parseBlobNoPrefix);

    assert.deepStrictEqual(encoded.length, expected.length);
    assert.deepStrictEqual(encoded, expected);
  });

  it(`should decode segment data (random seed: ${seed})`, () => {
    const chunks = expandShardsToFullSet(tinyChainSpec, seg_shards.map(BytesBlob.parseBlobNoPrefix)).map(
      (chunk, idx) => [idx, chunk] as [number, BytesBlob],
    );
    const selectedChunks = getRandomItems(chunks, 342);

    const decoded = reconstructData(selectedChunks, seg_data.length);

    assert.deepStrictEqual(decoded.toString().slice(2, seg_data.length + 2), seg_data);
  });

  it("should encode workpackage data", () => {
    const encoded = condenseShardsFromFullSet(tinyChainSpec, encodeChunks(BytesBlob.parseBlobNoPrefix(wp_data)));
    const expected = wp_shards.map(BytesBlob.parseBlobNoPrefix);

    assert.deepStrictEqual(encoded.length, expected.length);
    assert.deepStrictEqual(encoded, expected);
  });

  it(`should decode workpackage data (random seed: ${seed})`, () => {
    const chunks = expandShardsToFullSet(tinyChainSpec, wp_shards.map(BytesBlob.parseBlobNoPrefix)).map(
      (chunk, idx) => [idx, chunk] as [number, BytesBlob],
    );
    const selectedChunks = getRandomItems(chunks, 342);

    const decoded = reconstructData(selectedChunks, wp_data.length);

    assert.deepStrictEqual(decoded.toString().slice(2, wp_data.length + 2), wp_data);
  });

  it(`should encode and decode segment data without a change (random seed: ${seed})`, () => {
    const encoded = condenseShardsFromFullSet(tinyChainSpec, encodeChunks(BytesBlob.parseBlobNoPrefix(seg_data)));
    const selectedChunks = getRandomItems(
      expandShardsToFullSet(tinyChainSpec, encoded).map((x, idx) => [idx, x] as [number, BytesBlob]),
      342,
    );
    const decoded = reconstructData(selectedChunks, seg_data.length);

    assert.deepStrictEqual(decoded.toString().slice(2, seg_data.length + 2), seg_data);
  });

  it(`should encode and decode workpackage data without a change (random seed: ${seed})`, () => {
    const encoded = condenseShardsFromFullSet(tinyChainSpec, encodeChunks(BytesBlob.parseBlobNoPrefix(wp_data)));
    const selectedChunks = getRandomItems(
      expandShardsToFullSet(tinyChainSpec, encoded).map((x, idx) => [idx, x] as [number, BytesBlob]),
      342,
    );
    const decoded = reconstructData(selectedChunks, wp_data.length);

    assert.deepStrictEqual(decoded.toString().slice(2, wp_data.length + 2), wp_data);
  });
});

describe("erasure coding: split", () => {
  it("should split data", () => {
    const test = [
      {
        input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03]),
        expected: [BytesBlob.blobFromNumbers([0x00, 0x01]), BytesBlob.blobFromNumbers([0x02, 0x03])],
        size: 2,
      },
      {
        input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
        expected: [
          BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03]),
          BytesBlob.blobFromNumbers([0x04, 0x05, 0x06, 0x07]),
        ],
        size: 4,
      },
      {
        input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
        expected: [
          BytesBlob.blobFromNumbers([0x00, 0x01]),
          BytesBlob.blobFromNumbers([0x02, 0x03]),
          BytesBlob.blobFromNumbers([0x04, 0x05]),
          BytesBlob.blobFromNumbers([0x06, 0x07]),
        ],
        size: 2,
      },
      {
        input: BytesBlob.blobFromNumbers([0x00]),
        expected: [BytesBlob.blobFrom(new Uint8Array(648))],
        size: 648,
      },
      {
        input: BytesBlob.empty(),
        expected: [],
        size: 648,
      },
    ];

    for (const { input, expected, size } of test) {
      const result = split(input, size);

      assert.deepStrictEqual(result.length, expected.length);
      assert.deepStrictEqual(result, expected);
    }
  });
});

describe("erasure coding: join", () => {
  it("should join data", () => {
    const test = [
      {
        input: [BytesBlob.blobFromNumbers([0x00, 0x01]), BytesBlob.blobFromNumbers([0x02, 0x03])],
        expected: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03]),
        size: 2,
      },
      {
        input: [
          BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03]),
          BytesBlob.blobFromNumbers([0x04, 0x05, 0x06, 0x07]),
        ],
        expected: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
        size: 4,
      },
      {
        input: [
          BytesBlob.blobFromNumbers([0x00, 0x01]),
          BytesBlob.blobFromNumbers([0x02, 0x03]),
          BytesBlob.blobFromNumbers([0x04, 0x05]),
          BytesBlob.blobFromNumbers([0x06, 0x07]),
        ],
        expected: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
        size: 2,
      },
      {
        input: [BytesBlob.blobFrom(new Uint8Array(648))],
        expected: BytesBlob.blobFrom(new Uint8Array(648)),
        size: 648,
      },
      {
        input: [],
        expected: BytesBlob.empty(),
        size: 648,
      },
    ];

    for (const { input, expected, size } of test) {
      const result = join(input, size);

      assert.deepStrictEqual(result.length, expected.length);
      assert.deepStrictEqual(result, expected);
    }
  });

  it("should split and join data without a change", () => {
    const test = [
      { input: BytesBlob.blobFromNumbers([0x00, 0x01]), size: 2 },
      { input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03]), size: 4 },
      { input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]), size: 2 },
      { input: BytesBlob.blobFrom(new Uint8Array(648)), size: 648 },
      { input: BytesBlob.blobFrom(new Uint8Array(1)), size: 1 },
    ];

    for (const { input, size } of test) {
      const unzipped = split(input, size);
      const joined = join(unzipped, size);

      assert.deepStrictEqual(joined.length, input.length);
      assert.deepStrictEqual(joined, input);
    }
  });
});

describe("erasure coding: unzip", () => {
  it("should unzip data", () => {
    const test = [
      {
        input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03]),
        expected: [BytesBlob.blobFromNumbers([0x00, 0x02]), BytesBlob.blobFromNumbers([0x01, 0x03])],
        size: 2,
      },
      {
        input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
        expected: [
          BytesBlob.blobFromNumbers([0x00, 0x02, 0x04, 0x06]),
          BytesBlob.blobFromNumbers([0x01, 0x03, 0x05, 0x07]),
        ],
        size: 4,
      },
      {
        input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
        expected: [
          BytesBlob.blobFromNumbers([0x00, 0x04]),
          BytesBlob.blobFromNumbers([0x01, 0x05]),
          BytesBlob.blobFromNumbers([0x02, 0x06]),
          BytesBlob.blobFromNumbers([0x03, 0x07]),
        ],
        size: 2,
      },
      {
        input: BytesBlob.blobFromNumbers([0x00]),
        expected: [BytesBlob.blobFrom(new Uint8Array(648))],
        size: 648,
      },
      {
        input: BytesBlob.empty(),
        expected: [],
        size: 648,
      },
    ];

    for (const { input, expected, size } of test) {
      const result = unzip(input, size);

      assert.deepStrictEqual(result.length, expected.length);
      assert.deepStrictEqual(result, expected);
    }
  });
});

describe("erasure coding: lace", () => {
  it("should lace data", () => {
    const test = [
      {
        input: [BytesBlob.blobFromNumbers([0x00, 0x02]), BytesBlob.blobFromNumbers([0x01, 0x03])],
        expected: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03]),
        size: 2,
      },
      {
        input: [
          BytesBlob.blobFromNumbers([0x00, 0x02, 0x04, 0x06]),
          BytesBlob.blobFromNumbers([0x01, 0x03, 0x05, 0x07]),
        ],
        expected: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
        size: 4,
      },
      {
        input: [
          BytesBlob.blobFromNumbers([0x00, 0x04]),
          BytesBlob.blobFromNumbers([0x01, 0x05]),
          BytesBlob.blobFromNumbers([0x02, 0x06]),
          BytesBlob.blobFromNumbers([0x03, 0x07]),
        ],
        expected: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
        size: 2,
      },
      {
        input: [BytesBlob.blobFrom(new Uint8Array(648))],
        expected: BytesBlob.blobFromNumbers([0x00]),
        size: 1,
      },
      {
        input: [],
        expected: BytesBlob.empty(),
        size: 1,
      },
    ];

    for (const { input, expected, size } of test) {
      const result = lace(input, size);

      assert.deepStrictEqual(result.length, expected.length);
      assert.deepStrictEqual(result, expected);
    }
  });

  it("should unzip and lace data without a change", () => {
    const test = [
      { input: BytesBlob.blobFromNumbers([0x00, 0x01]) },
      { input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03]) },
      { input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]) },
      { input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]) },
    ];

    for (const { input } of test) {
      const unzipped = unzip(input, input.length);
      const laced = lace(unzipped, input.length);

      assert.deepStrictEqual(laced.length, input.length);
      assert.deepStrictEqual(laced, input);
    }
  });
});
