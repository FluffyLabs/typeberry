import assert from "node:assert";
import { describe, it } from "node:test";
import { HostCallRegisters } from "@typeberry/pvm-host-calls";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas.js";
import { Registers } from "@typeberry/pvm-interpreter/registers.js";
import { PartialStateMock } from "../externalities/partial-state-mock.js";
import { Checkpoint } from "./checkpoint.js";

const REGISTER = 7;

describe("HostCalls: Checkpoint", () => {
  it("should write U64 gas to register and checkpoint the state", async () => {
    const accumulate = new PartialStateMock();
    const checkpoint = new Checkpoint(accumulate);

    const counter = gasCounter(tryAsGas(2n ** 42n - 1n));
    const regs = new HostCallRegisters(new Registers());

    assert.deepStrictEqual(regs.get(REGISTER), 0n);
    assert.deepStrictEqual(accumulate.checkpointCalled, 0);

    // when
    await checkpoint.execute(counter, regs);

    // then
    assert.deepStrictEqual(regs.get(REGISTER), 2n ** 42n - 1n);
    assert.deepStrictEqual(accumulate.checkpointCalled, 1);
  });
});
