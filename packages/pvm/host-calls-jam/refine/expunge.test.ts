import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { MemoryBuilder, Registers, gasCounter, tryAsGas, tryAsMemoryIndex } from "@typeberry/pvm-interpreter";
import { OK, Result } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { Expunge } from "./expunge";
import { type MachineId, NoMachineError, tryAsMachineId } from "./refine-externalities";
import { TestRefineExt } from "./refine-externalities.test";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;

describe("HostCalls: Expunge", () => {
  it("should expunge machine", async () => {
    const { expunge, registers } = prepareTest(Result.ok(OK));

    // when
    await expunge.execute(gas, registers);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OK);
  });

  it("should fail if machine unknown", async () => {
    const { expunge, registers } = prepareTest(Result.error(NoMachineError));

    // when
    await expunge.execute(gas, registers);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.WHO);
  });
});

function prepareRegsAndMemory(machineId: MachineId) {
  const registers = new Registers();
  registers.asUnsigned[7] = machineId;

  const builder = new MemoryBuilder();
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsMemoryIndex(0));

  return {
    registers,
    memory,
  };
}

function prepareTest(result: Result<OK, NoMachineError>) {
  const refine = new TestRefineExt();
  const expunge = new Expunge(refine);
  expunge.currentServiceId = tryAsServiceId(10_000);
  const machineId = tryAsMachineId(10_000);
  const { registers, memory } = prepareRegsAndMemory(machineId);
  refine.machineExpungeData.set(result, machineId);

  return {
    expunge,
    registers,
    memory,
  };
}
