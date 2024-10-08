import { check } from "@typeberry/utils";
import { ShardsCollection, decode, encode } from "reed-solomon-wasm/pkg";

const SHARD_ALIGNMENT = 64;
const N_SHARDS = 342;
const RESULT_SHARDS = 1023;
const N_REDUNDANCY = RESULT_SHARDS - N_SHARDS;

const FIRST_POINT_INDEX = 0;
const SECOND_POINT_INDEX = 32;

function getInputWithPadding(input: Uint8Array) {
  if (input.length >= 2 * N_SHARDS) {
    return input;
  }
  const inputWithPadding = new Uint8Array(2 * N_SHARDS);
  inputWithPadding.set(input);
  return inputWithPadding;
}

export function encodeData(input: Uint8Array) {
  check(
    input.length <= 2 * N_SHARDS,
    `length of input (${input.length}) should be equal to or less than ${2 * N_SHARDS}`,
  );
  const inputWithPadding = getInputWithPadding(input);

  const result = new Array<Uint8Array>(RESULT_SHARDS);

  const data = new Uint8Array(SHARD_ALIGNMENT * N_SHARDS);

  for (let i = 0; i < N_SHARDS; i++) {
    // fill original shards in result
    result[i] = new Uint8Array(2);
    result[i][0] = inputWithPadding[2 * i];
    result[i][1] = inputWithPadding[2 * i + 1];
    // fill array that will be passed to wasm lib
    data[i * SHARD_ALIGNMENT + FIRST_POINT_INDEX] = inputWithPadding[2 * i];
    data[i * SHARD_ALIGNMENT + SECOND_POINT_INDEX] = inputWithPadding[2 * i + 1];
  }

  const shards = new ShardsCollection(SHARD_ALIGNMENT, data);

  const encodingResult = encode(N_REDUNDANCY, SHARD_ALIGNMENT, shards);

  const encodedData = encodingResult.take_data();

  for (let i = 0; i < N_REDUNDANCY; i++) {
    result[i + N_SHARDS] = new Uint8Array(2);
    result[i + N_SHARDS][0] = encodedData[i * SHARD_ALIGNMENT + FIRST_POINT_INDEX];
    result[i + N_SHARDS][1] = encodedData[i * SHARD_ALIGNMENT + SECOND_POINT_INDEX];
  }

  return result;
}

export function decodeData(input: [number, Uint8Array][], expectedLength: number = 2 * N_SHARDS) {
  check(input.length === N_SHARDS, `length of input should be equal to ${N_SHARDS}`);
  const result = new Uint8Array(2 * N_SHARDS);
  const data = new Uint8Array(input.length * SHARD_ALIGNMENT);
  const indices = new Uint16Array(input.length);

  for (let i = 0; i < input.length; i++) {
    const [index, points] = input[i];
    data[i * SHARD_ALIGNMENT + FIRST_POINT_INDEX] = points[0];
    data[i * SHARD_ALIGNMENT + SECOND_POINT_INDEX] = points[1];
    indices[i] = index;
    if (index < N_SHARDS) {
      // fill original shards in result
      result[index * 2] = points[0];
      result[index * 2 + 1] = points[1];
    }
  }
  const shards = new ShardsCollection(SHARD_ALIGNMENT, data, indices);

  const decodingResult = decode(N_SHARDS, N_REDUNDANCY, SHARD_ALIGNMENT, shards);
  const resultIndices = decodingResult.take_indices(); // it has to be called before take_data
  const resultData = decodingResult.take_data(); // it destroys the result object in rust

  if (!resultIndices) {
    throw new Error("indices array should exist!");
  }

  check(resultData.length === resultIndices.length * SHARD_ALIGNMENT, "incorrect length of data or indices!");

  for (let i = 0; i < resultIndices.length; i++) {
    // fill reconstructed shards in result
    const index = resultIndices[i];
    result[2 * index] = resultData[i * SHARD_ALIGNMENT + FIRST_POINT_INDEX];
    result[2 * index + 1] = resultData[i * SHARD_ALIGNMENT + SECOND_POINT_INDEX];
  }

  return result.subarray(0, expectedLength);
}
