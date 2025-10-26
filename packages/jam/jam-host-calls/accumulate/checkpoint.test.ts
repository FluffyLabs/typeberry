import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { HostCallRegisters } from "@typeberry/pvm-host-calls";
import { tryAsGas } from "@typeberry/pvm-interface";
import { gasCounter } from "@typeberry/pvm-interpreter/gas.js";
import { PartialStateMock } from "../externalities/partial-state-mock.js";
import { emptyRegistersBuffer } from "../utils.js";
import { Checkpoint } from "./checkpoint.js";

const REGISTER = 7;

describe("HostCalls: Checkpoint", () => {
  it("should write U64 gas to register and checkpoint the state", async () => {
    const accumulate = new PartialStateMock();
    const serviceId = tryAsServiceId(10_000);
    const checkpoint = new Checkpoint(serviceId, accumulate);

    const counter = gasCounter(tryAsGas(2n ** 42n - 1n));
    const regs = new HostCallRegisters(emptyRegistersBuffer());

    assert.deepStrictEqual(regs.get(REGISTER), 0n);
    assert.deepStrictEqual(accumulate.checkpointCalled, 0);

    // when
    await checkpoint.execute(counter, regs);

    // then
    assert.deepStrictEqual(regs.get(REGISTER), 2n ** 42n - 1n);
    assert.deepStrictEqual(accumulate.checkpointCalled, 1);
  });
});
