import type { Bytes } from "@typeberry/bytes";
import { Blake2b } from "@typeberry/hash";
import { leBytesAsU32, tryAsU32, u32AsLeBytes } from "@typeberry/numbers";
import { check } from "@typeberry/utils";

const ENTROPY_BYTES = 32;
type ENTROPY_BYTES = typeof ENTROPY_BYTES;

/**
 * Deterministic variant of the Fisher–Yates shuffle function
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/3b9a013b9a01
 */
export function fisherYatesShuffle<T>(blake2b: Blake2b, arr: T[], entropy: Bytes<ENTROPY_BYTES>): T[] {
  check`${entropy.length === ENTROPY_BYTES} Expected entropy of length ${ENTROPY_BYTES}, got ${entropy.length}`;
  const n = arr.length;
  const randomNumbers = hashToNumberSequence(blake2b, entropy, arr.length);
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

function hashToNumberSequence(blake2b: Blake2b, entropy: Bytes<ENTROPY_BYTES>, length: number) {
  const result: number[] = new Array(length);
  const randomBytes = new Uint8Array(ENTROPY_BYTES + 4);
  randomBytes.set(entropy.raw);

  for (let i = 0; i < length; i++) {
    randomBytes.set(u32AsLeBytes(tryAsU32(Math.floor(i / 8))), ENTROPY_BYTES);
    const newHash = blake2b.hashBytes(randomBytes);
    const numberStartIndex = (4 * i) % 32;
    const numberEndIndex = numberStartIndex + 4;
    const number = leBytesAsU32(newHash.raw.subarray(numberStartIndex, numberEndIndex)) >>> 0;
    result[i] = number;
  }

  return result;
}
