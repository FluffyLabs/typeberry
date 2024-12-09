import assert from "node:assert";
import { describe, it } from "node:test";
import { type Gas, gasCounter } from "@typeberry/pvm-interpreter/gas";
import { Registers } from "@typeberry/pvm-interpreter/registers";
import { Checkpoint } from "./checkpoint";
import { TestAccumulate } from "./partial-state.test";

const REG_LOWER = 7;
const REG_UPPER = 8;

describe("HostCalls: Checkpoint", () => {
  it("should write U64 gas to registers and checkpoint the state", () => {
    const accumulate = new TestAccumulate();
    const checkpoint = new Checkpoint(accumulate);

    const counter = gasCounter((2n ** 42n - 1n) as Gas);
    const regs = new Registers();

    assert.deepStrictEqual(regs.get(REG_LOWER), 0);
    assert.deepStrictEqual(regs.get(REG_UPPER), 0);
    assert.deepStrictEqual(accumulate.checkpointCalled, 0);

    // when
    checkpoint.execute(counter, regs);

    // then
    assert.deepStrictEqual(regs.get(REG_LOWER), 0xffffffff);
    assert.deepStrictEqual(regs.get(REG_UPPER), 0x3ff);
    assert.deepStrictEqual(accumulate.checkpointCalled, 1);
  });
});
