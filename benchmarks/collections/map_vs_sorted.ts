import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup";
import { Ordering, SortedArray } from "@typeberry/collections";

const READS = 100;
const keys = ["xyz", "abc", "123", "def", "Abb"];
const converted = keys.map((key) => ({ key }));

module.exports = () =>
  suite(
    "Map vs SortedArray for small element count",

    add("Map", () => {
      const map = new Map();
      map.set(keys[0], { key: keys[0], value: true });
      map.set(keys[1], { key: keys[1], value: false });
      map.set(keys[2], { key: keys[2], value: true });

      return () => {
        for (let k = 0; k < READS; k += 1) {
          for (const field of converted) {
            const v = map.get(field.key);
            if (v) {
              dataCmp(v, field) === Ordering.Equal;
            }
          }
        }
      };
    }),

    add("Map-array", () => {
      const map = new Map();
      map.set(0, { key: keys[0], value: true });
      map.set(1, { key: keys[1], value: false });
      map.set(2, { key: keys[2], value: true });
      const len = map.size;
      return () => {
        for (let k = 0; k < READS; k += 1) {
          for (const field of converted) {
            for (let i = 0; i < len; i += 1) {
              const v = map.get(i);
              if (dataCmp(v, field) === Ordering.Equal) {
                break;
              }
            }
          }
        }
      };
    }),

    add("Array", () => {
      const map: Data[] = [];
      map.push({ key: keys[0], value: true });
      map.push({ key: keys[1], value: false });
      map.push({ key: keys[2], value: true });

      return () => {
        for (let k = 0; k < READS; k += 1) {
          for (const field of converted) {
            map.findIndex((v) => dataCmp(v, field) === Ordering.Equal);
          }
        }
      };
    }),

    add("SortedArray", () => {
      const map = new SortedArray<Data>(dataCmp);
      map.insert({ key: keys[0], value: true });
      map.insert({ key: keys[1], value: false });
      map.insert({ key: keys[2], value: true });

      return () => {
        for (let k = 0; k < READS; k += 1) {
          for (const field of converted) {
            map.findIndex(field);
          }
        }
      };
    }),

    cycle(),
    complete(),
    configure({}),
    ...save(__filename),
  );

type Data = { key: string; value?: boolean };
function dataCmp(a: Data, b: Data) {
  if (a.key < b.key) {
    return Ordering.Less;
  }

  if (a.key > b.key) {
    return Ordering.Greater;
  }

  return Ordering.Equal;
}

if (require.main === module) {
  module.exports();
}
