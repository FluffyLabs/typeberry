import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup";

class SomeClass {
  constructor(
    public value: number,
    public name: string,
  ) {}
}

module.exports = () =>
  suite(
    "Logger",

    add("console.log with string concat", () => {
      const obj = new SomeClass(5, "hello world!");
      return () => {
        // biome-ignore lint/suspicious/noConsoleLog: that's the whole point of the benchmark
        console.log(`[${obj.name}] has reached value ${obj.value}`);
      };
    }),

    add("console.log with args", () => {
      const obj = new SomeClass(5, "hello world!");
      return () => {
        // biome-ignore lint/suspicious/noConsoleLog: that's the whole point of the benchmark
        console.log(obj.name, " has reached value ", obj.value);
      };
    }),
    cycle(),
    complete(),
    configure({}),
    ...save(__filename),
  );

if (require.main === module) {
  module.exports();
}
