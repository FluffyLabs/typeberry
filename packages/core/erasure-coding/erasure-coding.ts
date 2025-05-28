import { BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { check } from "@typeberry/utils";
import { ShardsCollection, decode, encode } from "reed-solomon-wasm/pkg";

/**
 * Shard size must be multiple of 64 bytes.
 * (reed-solomon-simd limitation: https://github.com/ordian/reed-solomon-simd)
 */
const SHARD_ALIGNMENT = 64;

/**
 * The following values are the consequences of the coding rate 342:1023
 * https://graypaper.fluffylabs.dev/#/579bd12/3c55003c5500
 */
const N_SHARDS = 342;
const RESULT_SHARDS = 1023;
/** `RESULT_SHARDS - N_SHARDS`: `681` */
const N_REDUNDANCY = RESULT_SHARDS - N_SHARDS;

/**
 * reed-solomon-simd requires shard size to be multiple of 64 bytes but we need only 2 bytes.
 * It does not matter what indices are selected, but it has to be n and n + 32
 */
const POINT_SIZE = 32;

/**
 * The shards are 2 bytes length because the encoding function is defined in GF(16)
 * https://graypaper.fluffylabs.dev/#/579bd12/3c17003c1700
 */
const SHARD_LENGTH = 2;

function padInput(input: Uint8Array, minSize = SHARD_LENGTH * N_SHARDS) {
  if (input.length >= minSize) {
    return input;
  }
  const padded = new Uint8Array(minSize);
  padded.set(input);
  return padded;
}

export function encodeData(
  input: Uint8Array,
  optional:
    | {
        resultShards?: number;
        nShards?: number;
        shardLength?: number;
        nRedundancy?: number;
      }
    | undefined = undefined,
): Uint8Array[] {
  const nShards = optional?.nShards ?? N_SHARDS;
  const shardLength = optional?.shardLength ?? SHARD_LENGTH;
  const expectedLength = shardLength * nShards;
  const resultShards = optional?.resultShards ?? RESULT_SHARDS;
  const nRedundancy = optional?.nRedundancy ?? N_REDUNDANCY;

  check(
    input.length <= expectedLength,
    `length of input (${input.length}) should be equal to or less than ${expectedLength}`,
  );

  const inputWithPadding = padInput(input, expectedLength);

  const result = new Array<Uint8Array>(resultShards);

  const data = new Uint8Array(SHARD_ALIGNMENT * nShards);

  for (let i = 0; i < nShards; i++) {
    // fill original shards in result
    const shardStart = shardLength * i;
    result[i] = new Uint8Array(inputWithPadding.slice(shardStart, shardStart + shardLength));
    // fill array that will be passed to wasm lib
    for (let j = 0; j < shardLength; j++) {
      data[i * SHARD_ALIGNMENT + j * POINT_SIZE] = inputWithPadding[shardStart + j];
    }
  }

  const shards = new ShardsCollection(SHARD_ALIGNMENT, data);

  const encodingResult = encode(nRedundancy, SHARD_ALIGNMENT, shards);

  const encodedData = encodingResult.take_data();

  for (let i = 0; i < nRedundancy; i++) {
    const idx = i + nShards;
    const shardIdx = i * SHARD_ALIGNMENT;

    result[idx] = new Uint8Array(shardLength);
    for (let j = 0; j < shardLength; j++) {
      result[idx][j] = encodedData[shardIdx + j * POINT_SIZE];
    }
  }

  return result;
}

// expectedLength can be useful to remove padding in case of short data (< 342)
export function decodeData(
  input: [number, Uint8Array][],
  optional:
    | {
        resultShards?: number;
        shardLength?: number;
        nShards?: number;
        nRedundancy?: number;
      }
    | undefined = undefined,
): Uint8Array {
  const shardLength = optional?.shardLength ?? SHARD_LENGTH;
  const nShards = optional?.nShards ?? N_SHARDS;
  const nRedundancy = optional?.nRedundancy ?? N_REDUNDANCY;
  const expectedLength = shardLength * nShards;

  check(input.length === nShards, `length of input should be equal to ${nShards}, got ${input.length}`);
  const result = new Uint8Array(shardLength * nShards);

  const data = new Uint8Array(input.length * SHARD_ALIGNMENT);
  const indices = new Uint16Array(input.length);

  for (let i = 0; i < input.length; i++) {
    const [index, points] = input[i];
    const shardStart = i * SHARD_ALIGNMENT;
    for (let j = 0; j < shardLength; j++) {
      data[shardStart + j * POINT_SIZE] = points[j];
    }
    indices[i] = index;
    if (index < nShards) {
      // fill original shards in result
      const shardStartInResult = shardLength * index;
      result.set(points, shardStartInResult);
    }
  }
  const shards = new ShardsCollection(SHARD_ALIGNMENT, data, indices);

  const decodingResult = decode(nShards, nRedundancy, SHARD_ALIGNMENT, shards);
  const resultIndices = decodingResult.take_indices(); // it has to be called before take_data
  const resultData = decodingResult.take_data(); // it destroys the result object in rust

  if (resultIndices === undefined) {
    throw new Error("indices array in decoded result must exist!");
  }

  check(resultData.length === resultIndices.length * SHARD_ALIGNMENT, "incorrect length of data or indices!");

  for (let i = 0; i < resultIndices.length; i++) {
    // fill reconstructed shards in result
    const index = resultIndices[i];
    const resultIdx = shardLength * index;
    const shardIdx = i * SHARD_ALIGNMENT;
    for (let j = 0; j < shardLength; j++) {
      result[resultIdx + j] = resultData[shardIdx + j * POINT_SIZE];
    }
  }

  return result.subarray(0, expectedLength);
}

/**
 * `split`: Takes a single BytesBlob and divides it into sequential,
 * contiguous chunks of a given size.
 *
 * Input: [a0, a1, a2, a3, a4, a5], size = 2
 *
 * Output: [[a0, a1], [a2, a3], [a4, a5]]
 *
 * NOTE: Last chunk is padded with zeroes if the input is shorter than `size`.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/3eb4013eb401?v=0.6.6
 */
export function split(input: BytesBlob, size: number): BytesBlob[] {
  const pieces = Math.ceil(input.length / size);
  const result = new Array<BytesBlob>(pieces);
  for (let i = 0; i < pieces; i++) {
    const start = i * size;
    const end = Math.min(start + size, input.length);
    const chunk = BytesBlob.blobFrom(new Uint8Array(size));
    chunk.raw.set(input.raw.subarray(start, end));
    result[i] = chunk;
  }
  return result;
}

/**
 * `join`: Takes an array of blobs and concatenates them sequentially
 * (one after another) into a single blob.
 *
 * Input: [[a0, a1], [a2, a3], [a4, a5]], size = 2
 *
 * Output: [a0, a1, a2, a3, a4, a5]
 *
 * NOTE: Output is padded with zeroes if the input's chunk is shorter than
 * `size`.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/3ed4013ed401?v=0.6.6
 */
export function join(input: BytesBlob[], size: number): BytesBlob {
  const result = BytesBlob.blobFrom(new Uint8Array(input.length * size));
  for (let i = 0; i < input.length; i++) {
    const start = i * size;
    const end = Math.min(start + size, result.length);
    result.raw.set(input[i].raw.subarray(0, end - start), start);
  }
  return result;
}

/**
 * `unzip`: Reorganizes the data by de-interleaving: it takes every N-th byte
 * for each output chunk, where N is the number of output pieces.
 *
 * Input: [a0, b0, c0, a1, b1, c1], size = 2
 * Output: [[a0, a1], [b0, b1], [c0, c1]]
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/3e06023e0602?v=0.6.6
 */
export function unzip(input: BytesBlob, size = SHARD_LENGTH * N_SHARDS): BytesBlob[] {
  const pieces = Math.ceil(input.length / size);
  const result = Array.from({ length: pieces }, () => BytesBlob.blobFrom(new Uint8Array(size)));
  for (let i = 0; i < pieces; i++) {
    for (let j = 0; j < size; j++) {
      result[i].raw[j] = input.raw[j * pieces + i];
    }
  }
  return result;
}

/**
 * `lace`: Takes an array of blobs and interleaves their bytes:
 * it takes the first byte from each blob, then the second byte from
 * each blob, etc., producing a single blob.
 *
 * Input: [[a0, a1], [b0, b1], [c0, c1]]
 *
 * Output: [a0, b0, c0, a1, b1, c1]
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/3e2a023e2a02?v=0.6.6
 */
export function lace(input: BytesBlob[], size = SHARD_LENGTH): BytesBlob {
  const pieces = input.length;
  const result = BytesBlob.blobFrom(new Uint8Array(pieces * size));
  for (let i = 0; i < pieces; i++) {
    for (let j = 0; j < size; j++) {
      result.raw[j * pieces + i] = input[i].raw[j];
    }
  }
  return result;
}

/**
 * `T`: Transposing function which accepts an array of `k` pieces of data
 * which each have same lenght of `n` octets and returns an array of `n`
 * pieces of data which each have length of `k` octets.
 *
 * T[[x0,0, x0,1, x0,2, . . . ], [x1,0, x1,1, . . . ], . . . ] ≡
 * [[x0,0, x1,0, x2,0, . . . ], [x0,1, x1,1, . . . ], . . . ]
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/3e2e023e2e02?v=0.6.6
 */
export function transpose(input: BytesBlob[]): BytesBlob[] {
  if (input.length === 0 || input.length === 1) {
    return input;
  }
  const shardLength = input[0].length;
  const result = Array.from({ length: shardLength }, () => BytesBlob.blobFrom(new Uint8Array(input.length)));
  for (let seg = 0; seg < shardLength; seg += 2) {
    for (let i = 0; i < input.length; i++) {
      result[i].raw.set(input[i].raw.subarray(seg, seg + 2), i * seg);
    }
  }
  return result;
}

/**
 * Encoding function which accepts an arbitrary sized data
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/3f15003f1500?v=0.6.6
 */
export function encodeChunks(input: BytesBlob, chainSpec: ChainSpec): BytesBlob[] {
  const vc = chainSpec.validatorsCount;
  const optional = {
    resultShards: vc,
    nShards: vc === 6 ? SHARD_LENGTH : N_SHARDS,
    nRedundancy: vc - (vc === 6 ? SHARD_LENGTH : N_SHARDS),
    shardLength: vc === 6 ? N_SHARDS : SHARD_LENGTH,
  };

  const encodedPieces: BytesBlob[] = [];
  for (const piece of unzip(input)) {
    const encoded = encodeData(piece.raw, optional);
    for (let i = 0; i < encoded.length; i++) {
      encodedPieces[i] ??= BytesBlob.empty();
      const newLength = encodedPieces[i].length + encoded[i].length;
      const newResult = BytesBlob.blobFrom(new Uint8Array(newLength));
      newResult.raw.set(encodedPieces[i].raw, 0);
      newResult.raw.set(encoded[i], encodedPieces[i].length);
      encodedPieces[i] = newResult;
    }
  }
  return encodedPieces;
}

export function reconstructData(input: [number, BytesBlob][], chainSpec: ChainSpec, expectedLength: number): BytesBlob {
  const vc = chainSpec.validatorsCount;
  const optional = {
    resultShards: vc,
    nShards: vc === 6 ? SHARD_LENGTH : N_SHARDS,
    nRedundancy: vc - (vc === 6 ? SHARD_LENGTH : N_SHARDS),
    shardLength: vc === 6 ? N_SHARDS : SHARD_LENGTH,
  };
  const trimInput = input.slice(0, optional.nShards);
  const result = new Array<BytesBlob>();
  const pieces = trimInput[0][1].length / optional.shardLength;

  for (let i = 0; i < pieces; i++) {
    const start = i * optional.shardLength;
    const arrayInput = trimInput.map(
      ([index, piece]) => [index, piece.raw.slice(start, start + optional.shardLength)] as [number, Uint8Array],
    );

    result.push(BytesBlob.blobFrom(decodeData(arrayInput, optional)));
  }
  const laced = lace(result, expectedLength);
  return BytesBlob.blobFrom(laced.raw.slice(0, expectedLength));
}
