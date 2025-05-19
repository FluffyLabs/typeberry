import util from "node:util";
import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup.js";

class SomeClass {
  constructor(
    public value: number,
    public name: string,
  ) {}
}

/**
 * Since console.log is mostly just the `util.format` + access to stdout,
 * we overwrite it here to avoid spamming the console while running benchmarks.
 */
const logs: string[] = [];
function fakeConsoleLog(...args: unknown[]) {
  // biome-ignore lint/style/useTemplate: We want to be as close to the console.log impl as possible.
  logs.push(util.format.apply(null, args) + "\n");
}

module.exports = () =>
  suite(
    "Logger",

    add("console.log with string concat", () => {
      const obj = new SomeClass(5, "hello world!");
      return () => {
        fakeConsoleLog(`[${obj.name}] has reached value ${obj.value}`);
      };
    }),

    add("console.log with args", () => {
      const obj = new SomeClass(5, "hello world!");
      return () => {
        fakeConsoleLog(obj.name, " has reached value ", obj.value);
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
