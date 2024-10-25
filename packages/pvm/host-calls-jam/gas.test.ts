import assert from "node:assert";
import { describe, it } from "node:test";
import { type Gas, gasCounter } from "@typeberry/pvm-interpreter/gas";
import { Registers } from "../debugger-adapter";
import { Gas as GasHostCall } from "./gas";

const REG_LOWER = 7;
const REG_UPPER = 8;

describe("HostCalls: Gas", () => {
  it("should write U32 gas to registers", () => {
    const gas = new GasHostCall();

    const counter = gasCounter(10_000 as Gas);
    const regs = new Registers();

    assert.deepStrictEqual(regs.asUnsigned[REG_LOWER], 0);
    assert.deepStrictEqual(regs.asUnsigned[REG_UPPER], 0);

    // when
    gas.execute(counter, regs);

    // then
    assert.deepStrictEqual(regs.asUnsigned[REG_LOWER], 10_000);
    assert.deepStrictEqual(regs.asUnsigned[REG_UPPER], 0);
  });

  it("should write U64 gas to registers", () => {
    const gas = new GasHostCall();

    const counter = gasCounter((2n ** 42n - 1n) as Gas);
    const regs = new Registers();

    assert.deepStrictEqual(regs.asUnsigned[REG_LOWER], 0);
    assert.deepStrictEqual(regs.asUnsigned[REG_UPPER], 0);

    // when
    gas.execute(counter, regs);

    // then
    assert.deepStrictEqual(regs.asUnsigned[REG_LOWER], 0xffffffff);
    assert.deepStrictEqual(regs.asUnsigned[REG_UPPER], 0x3ff);
  });
});
