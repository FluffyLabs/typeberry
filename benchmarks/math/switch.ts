import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup.js";

const x: number = 1;

module.exports = () =>
  suite(
    "Switch vs if",

    add("switch", () => {
      switch (x) {
        case 0:
          return 15;
        case 1:
          return 5;
        default:
          return null;
      }
    }),

    add("if", () => {
      if (x === 0) {
        return 15;
      }

      if (x === 1) {
        return 5;
      }

      return null;
    }),

    cycle(),
    complete(),
    configure({}),
    ...save(import.meta.filename),
  );

if (require.main === module) {
  module.exports();
}
