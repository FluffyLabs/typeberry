import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { HostCallRegisters } from "@typeberry/pvm-host-calls";
import { tryAsGas } from "@typeberry/pvm-interface";
import { gasCounter } from "@typeberry/pvm-interpreter";
import { emptyRegistersBuffer } from "../utils.js";
import { GasHostCall } from "./gas.js";

const REGISTER = 7;

describe("HostCalls: Gas", () => {
  it("should write U32 gas to register", () => {
    const currentServiceId = tryAsServiceId(10_000);
    const gas = new GasHostCall(currentServiceId);

    const counter = gasCounter(tryAsGas(10_000));
    const regs = new HostCallRegisters(emptyRegistersBuffer());

    assert.deepStrictEqual(regs.get(REGISTER), 0n);

    // when
    gas.execute(counter, regs);

    // then
    assert.deepStrictEqual(regs.get(REGISTER), 10_000n);
  });

  it("should write U64 gas to register", () => {
    const currentServiceId = tryAsServiceId(10_000);
    const gas = new GasHostCall(currentServiceId);

    const counter = gasCounter(tryAsGas(2n ** 64n - 1n));
    const regs = new HostCallRegisters(emptyRegistersBuffer());

    assert.deepStrictEqual(regs.get(REGISTER), 0n);

    // when
    gas.execute(counter, regs);

    // then
    assert.deepStrictEqual(regs.get(REGISTER), 2n ** 64n - 1n);
  });
});
