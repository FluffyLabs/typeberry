import { BytesBlob } from "@typeberry/bytes";
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

export function encodeData(input: Uint8Array): Uint8Array[] {
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
export function decodeData(
  input: [number, Uint8Array][],
  expectedLength: number = SHARD_LENGTH * N_SHARDS,
): Uint8Array {
  check(input.length === N_SHARDS, `length of input should be equal to ${N_SHARDS}, got ${input.length}`);
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

/**
 * `split`: Splitting function which accepts a blob of data and returns
 * `k` pieces of data, each of `size` octets.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/3eb4013eb401?v=0.6.6
 */
export function split(input: BytesBlob, size = SHARD_LENGTH * N_SHARDS): BytesBlob[] {
  const pieces = Math.ceil(input.length / size);
  const result = new Array<BytesBlob>(pieces);
  for (let i = 0; i < pieces; i++) {
    const start = i * size;
    const end = Math.min(start + size, input.length);
    const chunk = BytesBlob.empty({ size });
    chunk.raw.set(input.raw.subarray(start, end));
    result[i] = chunk;
  }
  return result;
}

/**
 * `join`: Joining function which accepts `k` pieces of data, each of `size` octets
 * and returns a single blob of data.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/3ed4013ed401?v=0.6.6
 */
export function join(input: BytesBlob[], size = SHARD_LENGTH * N_SHARDS): BytesBlob {
  const result = BytesBlob.empty({ size: input.length * size });
  for (let i = 0; i < input.length; i++) {
    const start = i * size;
    const end = Math.min(start + size, result.length);
    result.raw.set(input[i].raw.subarray(0, end - start), start);
  }
  return result;
}

/**
 * `unzip`: Unzipping function which accepts a blob of data and returns
 * `k` pieces of data, each of `n` size octets.
 * Reorganizes the data.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/3e06023e0602?v=0.6.6
 */
export function unzip(input: BytesBlob, size = SHARD_LENGTH * N_SHARDS): BytesBlob[] {
  const pieces = Math.ceil(input.length / size);
  const result = new Array<BytesBlob>(pieces);
  for (let i = 0; i < pieces; i++) {
    const chunk = BytesBlob.empty({ size });
    for (let j = 0; j < size; j++) {
      chunk.raw[j] = input.raw[j * pieces + i];
    }
    result[i] = chunk;
  }
  return result;
}

/**
 * `lace`: Lacing function which accepts `k` pieces of data, each of `n` size octets
 * and returns a single blob of data.
 * Opposite of `unzip`.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/3e2a023e2a02?v=0.6.6
 */
export function lace(input: BytesBlob[], size = SHARD_LENGTH): BytesBlob {
  const pieces = input.length;
  const result = BytesBlob.empty({ size: pieces * size });
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
  const result = new Array<BytesBlob>(shardLength);
  for (let seg = 0; seg < shardLength; seg += 2) {
    for (let i = 0; i < input.length; i++) {
      result[i] ??= BytesBlob.empty();
      const newLength = result[i].length + 2;
      const newResult = BytesBlob.empty({ size: newLength });
      newResult.raw.set(result[i].raw, 0);
      newResult.raw.set(input[i].raw.subarray(seg, seg + 2), result[i].length);
      result[i] = newResult;
    }
  }
  return result;
}

/**
 * Encoding function which accepts an arbitrary sized data
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/3f15003f1500?v=0.6.6
 */
export function encodeChunks(input: BytesBlob): BytesBlob[] {
  const encodedPieces: BytesBlob[] = [];
  for (const piece of unzip(input)) {
    const encoded = encodeData(piece.raw);
    for (let i = 0; i < encoded.length; i++) {
      encodedPieces[i] ??= BytesBlob.empty();
      const newLength = encodedPieces[i].length + encoded[i].length;
      const newResult = BytesBlob.empty({ size: newLength });
      newResult.raw.set(encodedPieces[i].raw, 0);
      newResult.raw.set(encoded[i], encodedPieces[i].length);
      encodedPieces[i] = newResult;
    }
  }
  return encodedPieces;
}

export function reconstructData(
  input: [number, BytesBlob][],
  expectedLength: number = SHARD_LENGTH * N_SHARDS,
): BytesBlob {
  check(input.length >= N_SHARDS, `length of input should be equal or more than ${N_SHARDS}`);
  const trimInput = input.slice(0, N_SHARDS);
  const result = new Array<BytesBlob>();
  const pieces = trimInput[0][1].length / SHARD_LENGTH;

  for (let i = 0; i < pieces; i++) {
    const start = i * SHARD_LENGTH;
    const arrayInput = trimInput.map(
      ([index, piece]) => [index, piece.raw.slice(start, start + SHARD_LENGTH)] as [number, Uint8Array],
    );

    check(
      arrayInput[0][1].length === SHARD_LENGTH,
      `length of input[0][1] should be equal to ${SHARD_LENGTH}, got ${arrayInput[0][1].length}`,
    );

    result.push(BytesBlob.blobFrom(decodeData(arrayInput)));
  }
  return lace(result, expectedLength);
}
