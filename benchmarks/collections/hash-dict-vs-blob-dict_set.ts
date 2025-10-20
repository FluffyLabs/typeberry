import { pathToFileURL } from "node:url";
import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup.js";
import { Bytes } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { BlobDictionary } from "@typeberry/collections/blob-dictionary.js";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";

const NO_OF_KEYS = 1000;

function key(n: number) {
  const key = Bytes.blobFromString(`${n}`);
  const ret = Bytes.zero(HASH_SIZE);
  ret.raw.set(key.raw, 0);
  return ret;
}

const KEYS = Array.from({ length: NO_OF_KEYS }, (_, i) => key(i));

export default function run() {
  return suite(
    "Comparing set operation in two hash dicts",

    add("HashDictionary", () => {
      const map = HashDictionary.new<OpaqueHash, number>();

      return () => {
        for (let k = 0; k < NO_OF_KEYS; k += 1) {
          map.set(KEYS[k], k);
        }
      };
    }),

    add("BlobDictionary", () => {
      const map = BlobDictionary.new<OpaqueHash, number>(7);

      return () => {
        for (let k = 0; k < NO_OF_KEYS; k += 1) {
          map.set(KEYS[k], k);
        }
      };
    }),

    cycle(),
    complete(),
    configure({}),
    ...save(import.meta.filename),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
