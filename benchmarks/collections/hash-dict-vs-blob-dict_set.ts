import { pathToFileURL } from "node:url";
import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup.js";
import { Bytes } from "@typeberry/bytes";
import { StringHashDictionary } from "@typeberry/collections";
import { BlobDictionary } from "@typeberry/collections/blob-dictionary.js";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import blake2b from "blake2b";

const NO_OF_KEYS = 1000;

function blake2bHasher(bytes: Bytes<HASH_SIZE>) {
  const hasher = blake2b(HASH_SIZE);
  return hasher.update(bytes.raw).digest("binary");
}
function longCollisionKey(n: number) {
  const key = Bytes.blobFromString(`${n}`);
  const ret = Bytes.zero(HASH_SIZE);
  ret.raw.set(key.raw, 0);
  ret.raw.reverse();
  return ret;
}

function hashKey(n: number) {
  return Bytes.fromBlob(blake2bHasher(longCollisionKey(n)), HASH_SIZE);
}

const LONG_COLLISION_KEYS = Array.from({ length: NO_OF_KEYS }, (_, i) => longCollisionKey(i));
const HASH_KEYS = Array.from({ length: NO_OF_KEYS }, (_, i) => hashKey(i));

export default function run() {
  const promises: ReturnType<typeof suite>[] = [];

  for (let threshold = 0; threshold < 10; threshold++) {
    const longCollisionTestPromise = suite(
      `Comparing set operation in two hash dicts using long collition keys and BlobDictionary(${threshold})`,

      add("StringHashDictionary", () => {
        const map = StringHashDictionary.new<OpaqueHash, number>();

        return () => {
          for (let k = 0; k < NO_OF_KEYS; k += 1) {
            map.set(LONG_COLLISION_KEYS[k], k);
          }
        };
      }),

      add("BlobDictionary", () => {
        const map = BlobDictionary.new<OpaqueHash, number>(threshold);

        return () => {
          for (let k = 0; k < NO_OF_KEYS; k += 1) {
            map.set(LONG_COLLISION_KEYS[k], k);
          }
        };
      }),

      cycle(),
      complete(),
      configure({}),
      ...save(import.meta.filename),
    );

    const hashKeyTestPromise = suite(
      `Comparing set operation in two hash dicts using hash keys and BlobDictionary(${threshold})`,

      add("StringHashDictionary", () => {
        const map = StringHashDictionary.new<OpaqueHash, number>();

        return () => {
          for (let k = 0; k < NO_OF_KEYS; k += 1) {
            map.set(HASH_KEYS[k], k);
          }
        };
      }),

      add("BlobDictionary", () => {
        const map = BlobDictionary.new<OpaqueHash, number>(threshold);

        return () => {
          for (let k = 0; k < NO_OF_KEYS; k += 1) {
            map.set(HASH_KEYS[k], k);
          }
        };
      }),

      cycle(),
      complete(),
      configure({}),
      ...save(import.meta.filename),
    );

    promises.push(longCollisionTestPromise, hashKeyTestPromise);
  }

  return Promise.allSettled(promises);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
