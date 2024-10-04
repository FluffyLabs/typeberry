import { Shard, decode, encode } from "reed-solomon-wasm/pkg";

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
  const inputWithPadding = getInputWithPadding(input);

  const shards = new Array(N_SHARDS);
  const result = new Array<Uint8Array>(RESULT_SHARDS);

  for (let i = 0; i < inputWithPadding.length; i += 2) {
    const shard = new Uint8Array(SHARD_ALIGNMENT);
    result[i / 2] = new Uint8Array(2);
    result[i / 2][0] = inputWithPadding[i];
    result[i / 2][1] = inputWithPadding[i + 1];
    shard[FIRST_POINT_INDEX] = inputWithPadding[i];
    shard[SECOND_POINT_INDEX] = inputWithPadding[i + 1];
    shards[i / 2] = shard;
  }

  const encodedData = encode(N_SHARDS, N_REDUNDANCY, SHARD_ALIGNMENT, shards);

  for (let i = 0; i < encodedData.length; i++) {
    result[i + N_SHARDS] = new Uint8Array(2);
    result[i + N_SHARDS][0] = encodedData[i][FIRST_POINT_INDEX];
    result[i + N_SHARDS][1] = encodedData[i][SECOND_POINT_INDEX];
  }

  return result;
}

export function decodeData(input: [number, Uint8Array][], expectedLength: number = 2 * N_SHARDS) {
  const result = new Uint8Array(2 * N_SHARDS);

  const shards = input.map(([index, points]) => {
    const data = new Uint8Array(SHARD_ALIGNMENT);
    data[FIRST_POINT_INDEX] = points[0];
    data[SECOND_POINT_INDEX] = points[1];
    if (index < N_SHARDS) {
      result.set(points, 2 * index);
    }
    return new Shard(index, data);
  });

  const decoded = decode(N_SHARDS, N_REDUNDANCY, SHARD_ALIGNMENT, shards);

  for (let i = 0; i < decoded.length; i++) {
    const shard = decoded[i];
    result[2 * shard.index] = decoded[i].data[FIRST_POINT_INDEX];
    result[2 * shard.index + 1] = decoded[i].data[SECOND_POINT_INDEX];
  }

  return result.subarray(0, expectedLength);
}
