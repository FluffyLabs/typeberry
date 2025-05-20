import { check } from "@typeberry/utils";
import { ShardsCollection, decode, encode } from "reed-solomon-wasm/pkg";

const SHARD_ALIGNMENT = 64; // Shard size must be multiple of 64 bytes. (reed-solomon-simd limitation: https://github.com/ordian/reed-solomon-simd)

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
const FIRST_POINT_INDEX = 0;
const SECOND_POINT_INDEX = 32;

/**
 * The shards are 2 bytes length because the encoding function is defined in GF(16)
 * https://graypaper.fluffylabs.dev/#/579bd12/3c17003c1700
 */
const SHARD_LENGTH = 2;

function getInputWithPadding(input: Uint8Array) {
  if (input.length >= SHARD_LENGTH * N_SHARDS) {
    return input;
  }
  const inputWithPadding = new Uint8Array(SHARD_LENGTH * N_SHARDS);
  inputWithPadding.set(input);
  return inputWithPadding;
}

export function encodeData(input: Uint8Array) {
  check(
    input.length <= SHARD_LENGTH * N_SHARDS,
    `length of input (${input.length}) should be equal to or less than ${SHARD_LENGTH * N_SHARDS}`,
  );
  // if the input is shorter than 342 we need to fill it with '0' to be 342
  const inputWithPadding = getInputWithPadding(input);

  const result = new Array<Uint8Array>(RESULT_SHARDS);

  const data = new Uint8Array(SHARD_ALIGNMENT * N_SHARDS);

  for (let i = 0; i < N_SHARDS; i++) {
    // fill original shards in result
    const shardStart = SHARD_LENGTH * i;
    result[i] = new Uint8Array(inputWithPadding.slice(shardStart, shardStart + SHARD_LENGTH));
    // fill array that will be passed to wasm lib
    data[i * SHARD_ALIGNMENT + FIRST_POINT_INDEX] = inputWithPadding[shardStart];
    data[i * SHARD_ALIGNMENT + SECOND_POINT_INDEX] = inputWithPadding[shardStart + 1];
  }

  const shards = new ShardsCollection(SHARD_ALIGNMENT, data);

  const encodingResult = encode(N_REDUNDANCY, SHARD_ALIGNMENT, shards);

  const encodedData = encodingResult.take_data();

  for (let i = 0; i < N_REDUNDANCY; i++) {
    const idx = i + N_SHARDS;
    const shardIdx = i * SHARD_ALIGNMENT;

    result[idx] = new Uint8Array(2);
    result[idx][0] = encodedData[shardIdx + FIRST_POINT_INDEX];
    result[idx][1] = encodedData[shardIdx + SECOND_POINT_INDEX];
  }

  return result;
}

// expectedLength can be useful to remove padding in case of short data (< 342)
export function decodeData(input: [number, Uint8Array][], expectedLength: number = SHARD_LENGTH * N_SHARDS) {
  check(input.length === N_SHARDS, `length of input should be equal to ${N_SHARDS}`);
  const result = new Uint8Array(SHARD_LENGTH * N_SHARDS);

  const data = new Uint8Array(input.length * SHARD_ALIGNMENT);
  const indices = new Uint16Array(input.length);

  for (let i = 0; i < input.length; i++) {
    const [index, points] = input[i];
    const shardStart = i * SHARD_ALIGNMENT;
    data[shardStart + FIRST_POINT_INDEX] = points[0];
    data[shardStart + SECOND_POINT_INDEX] = points[1];
    indices[i] = index;
    if (index < N_SHARDS) {
      // fill original shards in result
      const shardStartInResult = SHARD_LENGTH * index;
      result.set(points, shardStartInResult);
    }
  }
  const shards = new ShardsCollection(SHARD_ALIGNMENT, data, indices);

  const decodingResult = decode(N_SHARDS, N_REDUNDANCY, SHARD_ALIGNMENT, shards);
  const resultIndices = decodingResult.take_indices(); // it has to be called before take_data
  const resultData = decodingResult.take_data(); // it destroys the result object in rust

  if (resultIndices === undefined) {
    throw new Error("indices array in decoded result must exist!");
  }

  check(resultData.length === resultIndices.length * SHARD_ALIGNMENT, "incorrect length of data or indices!");

  for (let i = 0; i < resultIndices.length; i++) {
    // fill reconstructed shards in result
    const index = resultIndices[i];
    const resultIdx = SHARD_LENGTH * index;
    const shardIdx = i * SHARD_ALIGNMENT;

    result[resultIdx] = resultData[shardIdx + FIRST_POINT_INDEX];
    result[resultIdx + 1] = resultData[shardIdx + SECOND_POINT_INDEX];
  }

  return result.subarray(0, expectedLength);
}

export function split() {
  throw new Error("Not implemented yet!");
}

export function join() {
  throw new Error("Not implemented yet!");
}

/**
 * Unzipping function which accepts a blob of data and returns
 * `k` pieces of data, each of size 684 octets.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/3e06023e0602?v=0.6.6
 */
export function unzip(input: Uint8Array, size = 684): Uint8Array[] {
  const pieces = Math.ceil(input.length / size);
  const result = new Array<Uint8Array>(pieces);
  for (let i = 0; i < pieces; i++) {
    const start = i * size;
    const end = Math.min(start + size, input.length);
    result[i] = input.subarray(start, end);
  }
  return result;
}

export function lace() {
  throw new Error("Not implemented yet!");
}

function transpose() {
  throw new Error("Not implemented yet!");
}

/**
 * Chunking function which accepts an arbitrary sized data
 * blob whose length divides wholly into 684 octets and results in 1,023
 * sequences of sequences each of smaller blobs
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/3f15003f1500?v=0.6.6
 */
export function chunk() {
  throw new Error("Not implemented yet!");
}

export function reconstruct() {
  throw new Error("Not implemented yet!");
}
