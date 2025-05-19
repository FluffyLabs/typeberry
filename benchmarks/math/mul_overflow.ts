import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup.js";

const a = 0xffffff12 >>> 0;
const b = 0x34123412 >>> 0;

const MAX_U32 = 2 ** 32;

module.exports = () =>
  suite(
    "Wrapping Multiplication",

    add("multiply and bring back to u32", () => {
      const c1 = (a * b) >>> 0;
      return c1;
    }),

    add("multiply and take modulus", () => {
      const c1 = (a * b) % MAX_U32;
      return c1;
    }),

    cycle(),
    complete(),
    configure({}),
    ...save(import.meta.filename),
  );

if (require.main === module) {
  module.exports();
}
