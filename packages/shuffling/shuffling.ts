import type { Bytes } from "@typeberry/bytes";
import { blake2b } from "@typeberry/hash";
import { type U32, tryAsU32 } from "@typeberry/numbers";
import { check } from "@typeberry/utils";

const ENTROPY_BYTES = 32;
type ENTROPY_BYTES = typeof ENTROPY_BYTES;

/**
 * Deterministic variant of the Fisher–Yates shuffle function
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/3b9a013b9a01
 */
export function fisherYatesShuffle<T>(arr: T[], entropy: Bytes<ENTROPY_BYTES>): T[] {
  check(entropy.length === ENTROPY_BYTES, `Expected entropy of length ${ENTROPY_BYTES}, got ${entropy.length}`);
  const n = arr.length;
  const randomNumbers = hashToNumberSequence(entropy, arr.length);
  const result: T[] = new Array<T>(n);

  let itemsLeft = n;
  for (let i = 0; i < n; i++) {
    const j = randomNumbers[i] % itemsLeft;
    result[i] = arr[j];
    // swap with last and remove
    itemsLeft--;
    arr[j] = arr[itemsLeft];
    arr.length = itemsLeft;
  }

  return result;
}

function uint8ArrayToNumberLE(uint8Array: Uint8Array): number {
  check(uint8Array.length === 4, "Input must be a Uint8Array of length 4");
  return uint8Array[0] | (uint8Array[1] << 8) | (uint8Array[2] << 16) | (uint8Array[3] << 24);
}

function numberToUint8ArrayLE(num: U32): Uint8Array {
  const uint8Array = new Uint8Array(4);
  uint8Array[0] = num & 0xff;
  uint8Array[1] = (num >> 8) & 0xff;
  uint8Array[2] = (num >> 16) & 0xff;
  uint8Array[3] = (num >> 24) & 0xff;
  return uint8Array;
}

function hashToNumberSequence(entropy: Bytes<ENTROPY_BYTES>, length: number) {
  const result: number[] = new Array(length);
  const randomBytes = new Uint8Array(36);
  randomBytes.set(entropy.raw);

  for (let i = 0; i < length; i++) {
    const toConcat = numberToUint8ArrayLE(tryAsU32(Math.floor(i / 8)));
    randomBytes.set(toConcat, ENTROPY_BYTES);
    const newHash = blake2b.hashBytes(randomBytes);
    const numberStartIndex = (4 * i) % 32;
    const numberEndIndex = numberStartIndex + 4;
    const number = uint8ArrayToNumberLE(newHash.raw.subarray(numberStartIndex, numberEndIndex)) >>> 0;
    result[i] = number;
  }

  return result;
}
