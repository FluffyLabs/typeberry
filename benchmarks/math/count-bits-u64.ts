import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup.js";

const randomU64 =
  (BigInt(Math.floor(Math.random() * 0x100000000)) << 32n) | BigInt(Math.floor(Math.random() * 0x100000000));

function countBits64Magic(val: bigint) {
  let x = val; // Ensure the input is treated as a BigInt
  x = x - ((x >> 1n) & 0x5555555555555555n); // Subtract pairs of bits
  x = (x & 0x3333333333333333n) + ((x >> 2n) & 0x3333333333333333n); // Sum groups of 4 bits
  x = (x + (x >> 4n)) & 0x0f0f0f0f0f0f0f0fn; // Sum groups of 8 bits
  x = x + (x >> 8n); // Sum groups of 16 bits
  x = x + (x >> 16n); // Sum groups of 32 bits
  x = x + (x >> 32n); // Sum groups of 64 bits
  return Number(x & 0x7fn); // Mask and return result as a regular number (0–64)
}

export function countBits64(val: bigint): number {
  let count = 0;
  let value = val;
  while (value !== 0n) {
    value &= value - 1n; // Clear the lowest set bit
    count++;
  }
  return count;
}

module.exports = () =>
  suite(
    "Countings 1s in a u64 number",

    add("standard method", () => {
      return countBits64(randomU64);
    }),

    add("magic", () => {
      return countBits64Magic(randomU64);
    }),

    cycle(),
    complete(),
    configure({}),
    ...save(import.meta.filename),
  );

if (require.main === module) {
  module.exports();
}
