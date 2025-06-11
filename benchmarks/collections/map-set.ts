import { pathToFileURL } from "node:url";
import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup.js";

const NO_OF_UPDATES = 1000;

export default function run() {
  return suite(
    "Map: 2 gets and conditional set vs 1 get and 1 set ",

    add("2 gets + conditional set", () => {
      const key = 0;
      const initialValue = { counter: 0 };
      const map = new Map<number, typeof initialValue>();

      function conditionalSet(i: number) {
        const value = map.get(key) ?? initialValue;
        value.counter += i;
        if (!map.has(key)) {
          map.set(key, value);
        }
      }

      return () => {
        for (let k = 0; k < NO_OF_UPDATES; k += 1) {
          conditionalSet(k);
        }
      };
    }),

    add("1 get 1 set", () => {
      const key = 0;
      const initialValue = { counter: 0 };
      const map = new Map<number, typeof initialValue>();

      function unconditionalSet(i: number) {
        const value = map.get(key) ?? initialValue;
        value.counter += i;
        map.set(key, value);
      }

      return () => {
        for (let k = 0; k < NO_OF_UPDATES; k += 1) {
          unconditionalSet(k);
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
