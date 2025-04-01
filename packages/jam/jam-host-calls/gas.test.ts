import assert from "node:assert";
import { describe, it } from "node:test";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { Registers } from "@typeberry/pvm-interpreter/registers";
import { Gas as GasHostCall } from "./gas";

const REGISTER = 7;

describe("HostCalls: Gas", () => {
  it("should write U32 gas to register", () => {
    const gas = new GasHostCall();

    const counter = gasCounter(tryAsGas(10_000));
    const regs = Registers.new();

    assert.deepStrictEqual(regs.getU64(REGISTER), 0n);

    // when
    gas.execute(counter, regs);

    // then
    assert.deepStrictEqual(regs.getU64(REGISTER), 10_000n);
  });

  it("should write U64 gas to register", () => {
    const gas = new GasHostCall();

    const counter = gasCounter(tryAsGas(2n ** 64n - 1n));
    const regs = Registers.new();

    assert.deepStrictEqual(regs.getU64(REGISTER), 0n);

    // when
    gas.execute(counter, regs);

    // then
    assert.deepStrictEqual(regs.getU64(REGISTER), 2n ** 64n - 1n);
  });
});
