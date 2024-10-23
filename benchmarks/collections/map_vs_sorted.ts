import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup";
import { Ordering, SortedArray } from "@typeberry/collections";

const READS = 100;
const keys = ["xyz", "abc", "123", "def", "Abb"];

module.exports = () =>
  suite(
    "Map vs SortedArray for small element count",

    add("Map", () => {
      const map = new Map();
      map.set(keys[0], true);
      map.set(keys[1], false);
      map.set(keys[2], true);

      for (let k = 0; k < READS; k += 1) {
        for (const field of keys) {
          map.get(field);
        }
      }
    }),

    add("Array", () => {
      const map = Array(3);
      map.push(keys[0]);
      map.push(keys[1]);
      map.push(keys[2]);

      const len = map.length;
      for (let k = 0; k < READS; k += 1) {
        for (const field of keys) {
          for (let i = 0; i < len; i += 1) {
            if (map[i] === field) {
              break;
            }
          }
        }
      }
    }),

    add("SortedArray", () => {
      const map = new SortedArray<Data>(dataCmp);
      map.insert({ key: keys[0], value: true });
      map.insert({ key: keys[1], value: false });
      map.insert({ key: keys[2], value: true });

      for (let k = 0; k < READS; k += 1) {
        for (const field of keys) {
          map.get({ key: field });
        }
      }
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
