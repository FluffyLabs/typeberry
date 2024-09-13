import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup";

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
    ...save(__filename),
  );

if (require.main === module) {
  module.exports();
}
