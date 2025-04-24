import assert from "node:assert";
import { describe, it } from "node:test";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { Registers } from "@typeberry/pvm-interpreter/registers";
import { Gas as GasHostCall } from "./gas";
import { HostCallRegisters } from "@typeberry/pvm-host-calls";

const REGISTER = 7;

describe("HostCalls: Gas", () => {
  it("should write U32 gas to register", () => {
    const gas = new GasHostCall();

    const counter = gasCounter(tryAsGas(10_000));
    const regs = new HostCallRegisters(new Registers());

    assert.deepStrictEqual(regs.get(REGISTER), 0n);

    // when
    gas.execute(counter, regs);

    // then
    assert.deepStrictEqual(regs.get(REGISTER), 10_000n);
  });

  it("should write U64 gas to register", () => {
    const gas = new GasHostCall();

    const counter = gasCounter(tryAsGas(2n ** 64n - 1n));
    const regs = new HostCallRegisters(new Registers());

    assert.deepStrictEqual(regs.get(REGISTER), 0n);

    // when
    gas.execute(counter, regs);

    // then
    assert.deepStrictEqual(regs.get(REGISTER), 2n ** 64n - 1n);
  });
});
