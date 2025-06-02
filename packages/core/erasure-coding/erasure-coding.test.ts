import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config/chain-spec";
import { deepEqual } from "@typeberry/utils";
import { SEGMENT_FULL, SEGMENT_TINY, TEST_DATA, WORKPACKAGE_FULL, WORKPACKAGE_TINY } from "./ec-test-data";
import {
  N_SHARDS_REQUIRED,
  SHARD_LENGTH,
  chunkingFunction,
  condenseShardsFromFullSet,
  decodeChunk,
  decodeData,
  encodeChunk,
  expandShardsToFullSet,
  join,
  lace,
  split,
  unzip,
} from "./erasure-coding";

let seed = 1;
function random() {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function getRandomItems<T, N extends number>(arr: [number, T][], n: N): FixedSizeArray<[number, T], N> {
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

  return FixedSizeArray.new(result, n);
}

describe("erasure coding: general", () => {
  const data = TEST_DATA.data as string;
  const segmentEc = TEST_DATA.segment.segments[0].segment_ec;

  seed = Math.floor(1000 * Math.random());

  it("should encode data", () => {
    const encoded = encodeChunk(Bytes.parseBytesNoPrefix(data, 684));
    const expected = segmentEc.map((x) => Bytes.parseBytesNoPrefix(x, 2));

    assert.deepStrictEqual([...encoded], expected);
  });

  it(`should decode data (random seed: ${seed})`, () => {
    const chunks = segmentEc.map<[number, Bytes<SHARD_LENGTH>]>((chunk, idx) => [
      idx,
      Bytes.parseBytesNoPrefix(chunk, SHARD_LENGTH),
    ]);
    const selectedChunks = FixedSizeArray.new(getRandomItems(chunks, N_SHARDS_REQUIRED), N_SHARDS_REQUIRED);

    const decoded = decodeChunk(selectedChunks);

    assert.strictEqual(`${decoded}`, `0x${data}`);
  });
});

describe("erasure coding: full", () => {
  const wp_data = WORKPACKAGE_FULL.data as string;
  const wp_shards = WORKPACKAGE_FULL.shards;
  const seg_data = SEGMENT_FULL.data as string;
  const seg_shards = SEGMENT_FULL.shards;

  seed = Math.floor(1000 * Math.random());

  it("should encode segment data", () => {
    const encoded = chunkingFunction(BytesBlob.parseBlobNoPrefix(seg_data));
    const expected = seg_shards.map(BytesBlob.parseBlobNoPrefix);

    deepEqual([...encoded], expected);
  });

  it(`should decode segment data (random seed: ${seed})`, () => {
    const chunks = seg_shards.map<[number, Bytes<12>]>((chunk, idx) => [idx, Bytes.parseBytesNoPrefix(chunk, 12)]);
    const selectedChunks = getRandomItems(chunks, N_SHARDS_REQUIRED);

    const decoded = decodeData(selectedChunks);

    assert.deepStrictEqual(`${decoded}`, `0x${seg_data}`);
  });

  it("should encode workpackage data", () => {
    const encoded = chunkingFunction(BytesBlob.parseBlobNoPrefix(wp_data));
    const expected = wp_shards.map(BytesBlob.parseBlobNoPrefix);

    deepEqual([...encoded], expected);
  });

  it(`should decode workpackage data (random seed: ${seed})`, () => {
    const chunks = wp_shards.map<[number, Bytes<2>]>((chunk, idx) => [idx, Bytes.parseBytesNoPrefix(chunk, 2)]);
    const selectedChunks = getRandomItems(chunks, N_SHARDS_REQUIRED);

    const decoded = decodeData(selectedChunks);

    assert.deepStrictEqual(`${decoded}`, `0x${wp_data}`);
  });

  it(`should encode and decode segment data without a change (random seed: ${seed})`, () => {
    const encoded = chunkingFunction(BytesBlob.parseBlobNoPrefix(seg_data));
    const selectedChunks = getRandomItems(
      encoded.map<[number, BytesBlob]>((chunk, idx) => [idx, chunk]),
      N_SHARDS_REQUIRED,
    );
    const decoded = decodeData(selectedChunks);

    assert.deepStrictEqual(`${decoded}`, `0x${seg_data}`);
  });

  it(`should encode and decode workpackage data without a change (random seed: ${seed})`, () => {
    const encoded = chunkingFunction(BytesBlob.parseBlobNoPrefix(wp_data));
    const selectedChunks = getRandomItems(
      encoded.map((chunk, idx) => [idx, chunk] as [number, BytesBlob]),
      342,
    );
    const decoded = decodeData(selectedChunks);

    assert.deepStrictEqual(`${decoded}`, `0x${wp_data}`);
  });
});

describe("erasure coding: tiny", () => {
  const wp_data = WORKPACKAGE_TINY.data as string;
  const wp_shards = WORKPACKAGE_TINY.shards;
  const seg_data = SEGMENT_TINY.data as string;
  const seg_shards = SEGMENT_TINY.shards;

  seed = Math.floor(1000 * Math.random());

  it("should encode segment data", () => {
    const encoded = condenseShardsFromFullSet(tinyChainSpec, chunkingFunction(BytesBlob.parseBlobNoPrefix(seg_data)));
    const expected = seg_shards.map(BytesBlob.parseBlobNoPrefix);

    assert.deepStrictEqual(encoded.length, expected.length);
    assert.deepStrictEqual(encoded, expected);
  });

  it(`should decode segment data (random seed: ${seed})`, () => {
    const chunks = expandShardsToFullSet(tinyChainSpec, seg_shards.map(BytesBlob.parseBlobNoPrefix)).map(
      (chunk, idx) => [idx, chunk] as [number, BytesBlob],
    );
    const selectedChunks = getRandomItems(chunks, 342);

    const decoded = decodeData(selectedChunks);

    assert.strictEqual(`${decoded}`, `0x${seg_data}`);
  });

  it("should encode workpackage data", () => {
    const encoded = condenseShardsFromFullSet(tinyChainSpec, chunkingFunction(BytesBlob.parseBlobNoPrefix(wp_data)));
    const expected = wp_shards.map(BytesBlob.parseBlobNoPrefix);

    deepEqual(encoded, expected);
  });

  it(`should decode workpackage data (random seed: ${seed})`, () => {
    const chunks = expandShardsToFullSet(tinyChainSpec, wp_shards.map(BytesBlob.parseBlobNoPrefix)).map(
      (chunk, idx) => [idx, chunk] as [number, BytesBlob],
    );
    const selectedChunks = getRandomItems(chunks, 342);

    const decoded = decodeData(selectedChunks);

    assert.strictEqual(`${decoded}`, `0x${wp_data}`);
  });

  it(`should encode and decode segment data without a change (random seed: ${seed})`, () => {
    const encoded = condenseShardsFromFullSet(tinyChainSpec, chunkingFunction(BytesBlob.parseBlobNoPrefix(seg_data)));
    const selectedChunks = getRandomItems(
      expandShardsToFullSet(tinyChainSpec, encoded).map((x, idx) => [idx, x] as [number, BytesBlob]),
      342,
    );
    const decoded = decodeData(selectedChunks);

    assert.strictEqual(`${decoded}`, `0x${seg_data}`);
  });

  it(`should encode and decode workpackage data without a change (random seed: ${seed})`, () => {
    const encoded = condenseShardsFromFullSet(tinyChainSpec, chunkingFunction(BytesBlob.parseBlobNoPrefix(wp_data)));
    const selectedChunks = getRandomItems(
      expandShardsToFullSet(tinyChainSpec, encoded).map((x, idx) => [idx, x] as [number, BytesBlob]),
      342,
    );
    const decoded = decodeData(selectedChunks);

    assert.strictEqual(`${decoded}`, `0x${wp_data}`);
  });
});

describe("erasure coding: split", () => {
  it("should split data", () => {
    const test = [
      {
        input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03]),
        expected: [Bytes.fromNumbers([0x00, 0x01], 2), Bytes.fromNumbers([0x02, 0x03], 2)],
        size: 2,
      },
      {
        input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
        expected: [Bytes.fromNumbers([0x00, 0x01, 0x02, 0x03], 4), Bytes.fromNumbers([0x04, 0x05, 0x06, 0x07], 4)],
        size: 4,
      },
      {
        input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
        expected: [
          Bytes.fromNumbers([0x00, 0x01], 2),
          Bytes.fromNumbers([0x02, 0x03], 2),
          Bytes.fromNumbers([0x04, 0x05], 2),
          Bytes.fromNumbers([0x06, 0x07], 2),
        ],
        size: 2,
      },
      {
        input: BytesBlob.blobFrom(new Uint8Array(648)),
        expected: [Bytes.zero(648)],
        size: 648,
      },
      {
        input: BytesBlob.empty(),
        expected: [],
        size: 648,
      },
    ];

    for (const { input, expected, size } of test) {
      const result = split(input, size, input.length / size);

      assert.deepStrictEqual([...result], expected);
    }
  });
});

describe("erasure coding: join", () => {
  it("should join data", () => {
    const test = [
      {
        input: FixedSizeArray.new([Bytes.fromNumbers([0x00, 0x01], 2), Bytes.fromNumbers([0x02, 0x03], 2)], 2),
        expected: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03]),
      },
      {
        input: FixedSizeArray.new(
          [Bytes.fromNumbers([0x00, 0x01, 0x02, 0x03], 4), Bytes.fromNumbers([0x04, 0x05, 0x06, 0x07], 4)],
          2,
        ),
        expected: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
      },
      {
        input: FixedSizeArray.new(
          [
            Bytes.fromNumbers([0x00, 0x01], 2),
            Bytes.fromNumbers([0x02, 0x03], 2),
            Bytes.fromNumbers([0x04, 0x05], 2),
            Bytes.fromNumbers([0x06, 0x07], 2),
          ],
          4,
        ),
        expected: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
      },
      {
        input: FixedSizeArray.new([Bytes.zero(648)], 1),
        expected: BytesBlob.blobFrom(new Uint8Array(648)),
      },
      {
        input: FixedSizeArray.new([], 0),
        expected: BytesBlob.empty(),
      },
    ];

    for (const { input, expected } of test) {
      const result = join(input);

      assert.deepStrictEqual(result.length, expected.length);
      assert.deepStrictEqual(result, expected);
    }
  });

  it("should split and join data without a change", () => {
    const test = [
      { input: BytesBlob.blobFromNumbers([0x00, 0x01]), n: 1, k: 2 },
      { input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03]), k: 4, n: 1 },
      { input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]), k: 2, n: 4 },
      { input: BytesBlob.blobFrom(new Uint8Array(648)), k: 648, n: 1 },
      { input: BytesBlob.blobFrom(new Uint8Array(1)), k: 1, n: 1 },
    ];

    for (const { input, n, k } of test) {
      const splitted = split(input, n, k);
      const joined = join(splitted);

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
        n: 2,
        k: 2,
      },
      {
        input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
        expected: [Bytes.fromNumbers([0x00, 0x02, 0x04, 0x06], 4), Bytes.fromNumbers([0x01, 0x03, 0x05, 0x07], 4)],
        n: 4,
        k: 2,
      },
      {
        input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
        expected: [
          Bytes.fromNumbers([0x00, 0x04], 2),
          Bytes.fromNumbers([0x01, 0x05], 2),
          Bytes.fromNumbers([0x02, 0x06], 2),
          Bytes.fromNumbers([0x03, 0x07], 2),
        ],
        n: 2,
        k: 4,
      },
      {
        input: Bytes.zero(648),
        expected: [Bytes.zero(648)],
        k: 1,
        n: 648,
      },
      {
        input: BytesBlob.empty(),
        expected: [],
        k: 0,
        n: 648,
      },
    ];

    for (const { input, expected, n, k } of test) {
      const result = unzip(input, n, k);

      deepEqual([...result], expected);
    }
  });
});

describe("erasure coding: lace", () => {
  it("should lace data", () => {
    const test = [
      {
        input: FixedSizeArray.new([Bytes.fromNumbers([0x00, 0x02], 2), Bytes.fromNumbers([0x01, 0x03], 2)], 2),
        expected: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03]),
      },
      {
        input: FixedSizeArray.new(
          [Bytes.fromNumbers([0x00, 0x02, 0x04, 0x06], 4), Bytes.fromNumbers([0x01, 0x03, 0x05, 0x07], 4)],
          2,
        ),
        expected: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
      },
      {
        input: FixedSizeArray.new(
          [
            Bytes.fromNumbers([0x00, 0x04], 2),
            Bytes.fromNumbers([0x01, 0x05], 2),
            Bytes.fromNumbers([0x02, 0x06], 2),
            Bytes.fromNumbers([0x03, 0x07], 2),
          ],
          4,
        ),
        expected: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
      },
      {
        input: FixedSizeArray.new([Bytes.zero(648)], 1),
        expected: BytesBlob.blobFrom(new Uint8Array(648)),
      },
      {
        input: FixedSizeArray.new([], 0),
        expected: BytesBlob.empty(),
      },
    ];

    for (const { input, expected } of test) {
      const result = lace(input);

      assert.strictEqual(`${result}`, `${expected}`);
    }
  });

  it("should unzip and lace data without a change", () => {
    const test = [
      { input: BytesBlob.blobFromNumbers([0x00, 0x01]), n: 1, k: 2 },
      { input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03]), n: 2, k: 2 },
      { input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]), n: 2, k: 4 },
      { input: BytesBlob.blobFromNumbers([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]), n: 4, k: 2 },
    ];

    for (const { input, n, k } of test) {
      const unzipped = unzip(input, n, k);
      const laced = lace(unzipped);

      assert.strictEqual(`${laced}`, `${input}`);
    }
  });
});
