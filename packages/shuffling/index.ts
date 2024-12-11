import type { Bytes } from "@typeberry/bytes";
import { hashBytes } from "@typeberry/hash";
import { check } from "@typeberry/utils";

function concatUint8Array(arr1: Uint8Array, arr2: Uint8Array) {
  const newLength = arr1.length + arr2.length;
  const result = new Uint8Array(newLength);
  result.set(arr1);
  result.set(arr2, arr1.length);
  return result;
}

function uint8ArrayToNumberLE(uint8Array: Uint8Array): number {
  check(uint8Array.length === 4, "Input must be a Uint8Array of length 4");
  return uint8Array[0] | (uint8Array[1] << 8) | (uint8Array[2] << 16) | (uint8Array[3] << 24);
}

function numberToUint8ArrayLE(num: number): Uint8Array {
  check(Number.isInteger(num) && num >= 0 && num < 0xffffffff, `Input must be a 32-bit unsigned integer, got: ${num}`);
  const uint8Array = new Uint8Array(4);
  uint8Array[0] = num & 0xff;
  uint8Array[1] = (num >> 8) & 0xff;
  uint8Array[2] = (num >> 16) & 0xff;
  uint8Array[3] = (num >> 24) & 0xff;
  return uint8Array;
}

function hashToNumberSequence(entropy: Bytes<32>, length: number) {
  const result: number[] = new Array(length);

  for (let i = 0; i < length; i++) {
    const toConcat = numberToUint8ArrayLE(Math.floor(i / 8));
    const bytes = concatUint8Array(entropy.raw, toConcat);
    const newHash = hashBytes(bytes);
    const numberStartIndex = (4 * i) % 32;
    const numberEndIndex = numberStartIndex + 4;
    const number = uint8ArrayToNumberLE(newHash.raw.subarray(numberStartIndex, numberEndIndex)) >>> 0;
    result[i] = number;
  }

  return result;
}

export function fisherYatesShuffle<T>(arr: T[], entropy: Bytes<32>): T[] {
  const n = arr.length;
  const randomNumbers = hashToNumberSequence(entropy, arr.length);
  const result: T[] = new Array<T>(n);

  for (let i = 0; i < n; i++) {
    const j = randomNumbers[i] % arr.length;
    result[i] = arr[j];
    arr[j] = arr[arr.length - 1];
    arr.length = arr.length - 1;
  }

  return result;
}
