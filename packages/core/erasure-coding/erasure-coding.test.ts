import assert from "node:assert";
import { describe, it } from "node:test";
import { type PerValidator, tryAsPerValidator } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { deepEqual } from "@typeberry/utils";
import { SEGMENT_FULL, SEGMENT_TINY, TEST_DATA, WORKPACKAGE_FULL, WORKPACKAGE_TINY } from "./ec-test-data.js";
import {
  N_CHUNKS_REQUIRED,
  POINT_LENGTH,
  chunksToShards,
  decodeData,
  decodePiece,
  ecReady,
  encodePoints,
  join,
  lace,
  padAndEncodeData,
  shardsToChunks,
  split,
  unzip,
} from "./erasure-coding.js";

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

describe("erasure coding: general", async () => {
  await ecReady;

  const data = TEST_DATA.data as string;
  const segmentEc = TEST_DATA.segment.segments[0].segment_ec;

  seed = Math.floor(1000 * Math.random());

  it("should encode data", () => {
    const encoded = encodePoints(Bytes.parseBytesNoPrefix(data, 684));
    const expected = segmentEc.map((x) => Bytes.parseBytesNoPrefix(x, 2));

    assert.deepStrictEqual([...encoded], expected);
  });

  it(`should decode data (random seed: ${seed})`, () => {
    const shards = segmentEc.map<[number, Bytes<POINT_LENGTH>]>((chunk, idx) => [
      idx,
      Bytes.parseBytesNoPrefix(chunk, POINT_LENGTH),
    ]);
    const selectedShards = FixedSizeArray.new(getRandomItems(shards, N_CHUNKS_REQUIRED), N_CHUNKS_REQUIRED);

    const decoded = decodePiece(selectedShards);

    assert.strictEqual(`${decoded}`, `0x${data}`);
  });
});

describe("erasure coding: full", async () => {
  await ecReady;

  const wp_data = WORKPACKAGE_FULL.data as string;
  const wp_shards = WORKPACKAGE_FULL.shards;
  const seg_data = SEGMENT_FULL.data as string;
  const seg_shards = SEGMENT_FULL.shards;

  seed = Math.floor(1000 * Math.random());

  it("should encode segment data", () => {
    const encoded = padAndEncodeData(BytesBlob.parseBlobNoPrefix(seg_data));
    const expected = seg_shards.map(BytesBlob.parseBlobNoPrefix);

    deepEqual([...encoded], expected);
  });

  it(`should decode segment data (random seed: ${seed})`, () => {
    const shards = seg_shards.map<[number, Bytes<12>]>((chunk, idx) => [idx, Bytes.parseBytesNoPrefix(chunk, 12)]);
    const selectedShards = getRandomItems(shards, N_CHUNKS_REQUIRED);

    const decoded = decodeData(selectedShards);

    assert.deepStrictEqual(`${decoded}`, `0x${seg_data}`);
  });

  it("should encode workpackage data", () => {
    const encoded = padAndEncodeData(BytesBlob.parseBlobNoPrefix(wp_data));
    const expected = wp_shards.map(BytesBlob.parseBlobNoPrefix);

    deepEqual([...encoded], expected);
  });

  it(`should decode workpackage data (random seed: ${seed})`, () => {
    const shards = wp_shards.map<[number, Bytes<2>]>((chunk, idx) => [idx, Bytes.parseBytesNoPrefix(chunk, 2)]);
    const selectedShards = getRandomItems(shards, N_CHUNKS_REQUIRED);

    const decoded = decodeData(selectedShards);

    assert.deepStrictEqual(`${decoded}`, `0x${wp_data}`);
  });

  it(`should encode and decode segment data without a change (random seed: ${seed})`, () => {
    const segments = padAndEncodeData(BytesBlob.parseBlobNoPrefix(seg_data));
    const shards = segments.map<[number, BytesBlob]>((chunk, idx) => [idx, chunk]);
    const selectedShards = getRandomItems(shards, N_CHUNKS_REQUIRED);
    const decoded = decodeData(selectedShards);

    assert.deepStrictEqual(`${decoded}`, `0x${seg_data}`);
  });

  it(`should encode and decode workpackage data without a change (random seed: ${seed})`, () => {
    const segments = padAndEncodeData(BytesBlob.parseBlobNoPrefix(wp_data));
    const shards = segments.map<[number, BytesBlob]>((chunk, idx) => [idx, chunk]);
    const selectedShards = getRandomItems(shards, 342);
    const decoded = decodeData(selectedShards);

    assert.deepStrictEqual(`${decoded}`, `0x${wp_data}`);
  });
});

describe("erasure coding: tiny", async () => {
  await ecReady;

  const wp_data = WORKPACKAGE_TINY.data as string;
  const wp_shards = WORKPACKAGE_TINY.shards;
  const seg_data = SEGMENT_TINY.data as string;
  const seg_shards = SEGMENT_TINY.shards;

  seed = Math.floor(1000 * Math.random());

  it("should encode segment data", () => {
    const segments = chunksToShards(tinyChainSpec, padAndEncodeData(BytesBlob.parseBlobNoPrefix(seg_data)));
    const expected: PerValidator<BytesBlob> = tryAsPerValidator(
      seg_shards.map(BytesBlob.parseBlobNoPrefix),
      tinyChainSpec,
    );

    assert.deepStrictEqual(segments.length, expected.length);
    deepEqual(segments, expected);
  });

  it(`should decode segment data (random seed: ${seed})`, () => {
    const segments: PerValidator<BytesBlob> = tryAsPerValidator(
      seg_shards.map(BytesBlob.parseBlobNoPrefix),
      tinyChainSpec,
    );
    const shards = shardsToChunks(tinyChainSpec, segments);

    // slicing to remove duplicates
    const selectedShards = getRandomItems(shards.flat().slice(0, 1023), 342);

    const decoded = decodeData(selectedShards);

    deepEqual(`${decoded}`, `0x${seg_data}`);
  });

  it("should encode workpackage data", () => {
    const segments = chunksToShards(tinyChainSpec, padAndEncodeData(BytesBlob.parseBlobNoPrefix(wp_data)));
    const expected: PerValidator<BytesBlob> = tryAsPerValidator(
      wp_shards.map(BytesBlob.parseBlobNoPrefix),
      tinyChainSpec,
    );

    deepEqual(segments, expected);
  });

  it(`should decode workpackage data (random seed: ${seed})`, () => {
    const shards = shardsToChunks(
      tinyChainSpec,
      tryAsPerValidator(wp_shards.map(BytesBlob.parseBlobNoPrefix), tinyChainSpec),
    );

    // slicing to remove duplicates
    const selectedShards = getRandomItems(shards.flat().slice(0, 1023), 342);

    const decoded = decodeData(selectedShards);

    assert.strictEqual(`${decoded}`, `0x${wp_data}`);
  });

  it(`should encode and decode segment data without a change (random seed: ${seed})`, () => {
    const segments = chunksToShards(tinyChainSpec, padAndEncodeData(BytesBlob.parseBlobNoPrefix(seg_data)));
    const shards = shardsToChunks(tinyChainSpec, segments);
    // slicing to remove duplicates
    const selectedShards = getRandomItems(shards.flat().slice(0, 1023), 342);
    const decoded = decodeData(selectedShards);

    assert.strictEqual(`${decoded}`, `0x${seg_data}`);
  });

  it(`should encode and decode workpackage data without a change (random seed: ${seed})`, () => {
    const shards = padAndEncodeData(BytesBlob.parseBlobNoPrefix(wp_data)).map<[number, BytesBlob]>((shard, idx) => [
      idx,
      shard,
    ]);
    const selectedShards = getRandomItems(shards, 342);
    const decoded = decodeData(selectedShards);

    assert.strictEqual(`${decoded}`, `0x${wp_data}`);
  });
});

describe("erasure coding: split", async () => {
  await ecReady;

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

describe("erasure coding: join", async () => {
  await ecReady;

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

describe("erasure coding: unzip", async () => {
  await ecReady;

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

describe("erasure coding: lace", async () => {
  await ecReady;

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
