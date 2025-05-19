import { pathToFileURL } from "node:url";
import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup.js";

const randomU32 = Math.floor(Math.random() * 0x100000000);

function countBits32(val: number): number {
  let count = 0;
  let value = val;
  while (value !== 0) {
    value &= value - 1; // Clear the lowest set bit
    count++;
  }
  return count;
}

function countBits32Magic(val: number) {
  let x = val;
  x = x - ((x >> 1) & 0x55555555); // Subtract pairs of bits
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333); // Sum groups of 4 bits
  x = (x + (x >> 4)) & 0x0f0f0f0f; // Sum groups of 8 bits
  x = x + (x >> 8); // Sum groups of 16 bits
  x = x + (x >> 16); // Sum groups of 32 bits
  return x & 0x3f; // Mask out excess bits
}

export default function run() {
  suite(
    "Countings 1s in a u32 number",

    add("standard method", () => {
      return countBits32(randomU32);
    }),

    add("magic", () => {
      return countBits32Magic(randomU32);
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
