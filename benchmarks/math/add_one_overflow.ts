import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup.js";

const a = 0xff_ff_ff_ff >>> 0;
const ONE = 1 >>> 0;

const MAX_U32 = 2 ** 32;
// the purpose of this benchmark is to find the fastest option to calculate the next page number
module.exports = () =>
  suite(
    "Wrapping add one (incrementation)",

    add("add and take modulus", () => {
      const c1 = (a + ONE) % MAX_U32;
      return c1;
    }),

    add("condition before calculation", () => {
      const c1 = a === MAX_U32 ? 0 : a + ONE;
      return c1;
    }),

    cycle(),
    complete(),
    configure({}),
    ...save(__filename),
  );

if (require.main === module) {
  module.exports();
}
