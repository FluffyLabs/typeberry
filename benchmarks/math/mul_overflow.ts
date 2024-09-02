import { suite, add, cycle, complete, configure, save } from '@typeberry/benchmark/setup';

const a = 0xffffffff12;
const b = 0x1234123412;

module.exports = () => suite(
  "Wrapping Multiplication",

  add('multiply and bring back to u32', () => {
    const a1 = a >>> 0;
    const b1 = b >>> 0;
    const c1 = (a1 * b1) >>> 0;
    return c1;
  }),

  add('multiply and take modulus', () => {
    const c1 = (a * b) % 2**32;
    return c1;
  }),

  cycle(),
  complete(),
  configure({}),
  ...save(__filename),
)
