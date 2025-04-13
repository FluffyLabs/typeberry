import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { MemoryBuilder, Registers, gasCounter, tryAsGas } from "@typeberry/pvm-interpreter";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { Result } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { Expunge } from "./expunge";
import {
  type MachineId,
  NoMachineError,
  type ProgramCounter,
  tryAsMachineId,
  tryAsProgramCounter,
} from "./refine-externalities";
import { TestRefineExt } from "./refine-externalities.test";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;

function prepareRegsAndMemory(machineId: MachineId) {
  const registers = new Registers();
  registers.setU64(7, machineId);

  const builder = new MemoryBuilder();
  const memory = builder.finalize(tryAsSbrkIndex(0), tryAsSbrkIndex(0));

  return {
    registers,
    memory,
  };
}

function prepareTest(result: Result<ProgramCounter, NoMachineError>) {
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

describe("HostCalls: Expunge", () => {
  it("should expunge machine and return its program counter", async () => {
    const programCounter = tryAsProgramCounter(0x1234_5678_9abc_def0n);
    const { expunge, registers } = prepareTest(Result.ok(programCounter));

    // when
    const result = await expunge.execute(gas, registers);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG), programCounter);
  });

  it("should return WHO if machine unknown", async () => {
    const { expunge, registers } = prepareTest(Result.error(NoMachineError));

    // when
    const result = await expunge.execute(gas, registers);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG), HostCallResult.WHO);
  });
});
