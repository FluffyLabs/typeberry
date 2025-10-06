import { pathToFileURL } from "node:url";
import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup.js";
import { Bytes } from "@typeberry/bytes";

const HASH_SIZE = 4;
const ARRAY_SIZE = 10_000;

function isEqualTo<T extends number>(
  that: { data: Bytes<T>; view: DataView },
  other: { data: Bytes<T>; view: DataView },
) {
  const len = that.data.length;
  if (len !== other.data.length) {
    return false;
  }

  const a = that.view;
  const b = other.view;
  for (let i = 0; i < len; i += 4) {
    if (a.getUint32(i) !== b.getUint32(i)) {
      return false;
    }
  }

  return true;
}

export function leBytesAsU48(uint8Array: Uint8Array): number {
  return (
    uint8Array[0] |
    (uint8Array[1] << 8) |
    (uint8Array[2] << 16) |
    (uint8Array[3] << 24) |
    (uint8Array[4] << 32) |
    (uint8Array[5] << 40)
  );
}

function isEqualToU48<T extends number>(that: Bytes<T>, other: Bytes<T>) {
  const len = that.length;
  if (len !== other.length) {
    return false;
  }

  const a = that;
  const b = other;
  for (let i = 0; i < len; i += 6) {
    const aSlice = a.raw.subarray(i, i + 6);
    const bSlice = b.raw.subarray(i, i + 6);
    if (leBytesAsU48(aSlice) !== leBytesAsU48(bSlice)) {
      return false;
    }
  }

  return true;
}

function generateHash<T extends number>(len: T): Bytes<T> {
  const result: number[] = [];
  for (let i = 0; i < len; i += 1) {
    const val = Math.floor(Math.random() * 255);
    result.push(val);
  }
  return Bytes.fromNumbers(result, len);
}

function generateArrayOfHashes<T extends number>(size: number, hashLen: T): Bytes<T>[] {
  const res: Bytes<T>[] = [];
  for (let i = 0; i < size; i += 1) {
    res.push(generateHash(hashLen));
  }
  return res;
}

const arr = generateArrayOfHashes(ARRAY_SIZE, HASH_SIZE);

/**
 * Comparing Uint32 at a time MIGHT BE slightly faster in some
 * edge cases only if the data view is created eagerly!
 * and not worth the gains.
 */
export default function run() {
  return suite(
    "Bytes / comparison",
    add("Comparing Uint32 bytes", () => {
      const withView = arr.map((v) => ({
        data: v,
        view: new DataView(v.raw.buffer, v.raw.byteOffset),
      }));
      return () => {
        const x = withView[arr.length - 1];
        for (const y of withView) {
          isEqualTo(x, y);
        }
      };
    }),

    add("Comparing raw bytes", () => {
      return () => {
        const x = arr[arr.length - 1];
        for (const y of arr) {
          x.isEqualTo(y);
        }
      };
    }),

    add("Comparing U48 numbers", () => {
      return () => {
        const x = arr[arr.length - 1];
        for (const y of arr) {
          isEqualToU48(x, y);
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
