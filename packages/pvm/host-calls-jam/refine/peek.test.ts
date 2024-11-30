import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { tryAsU32 } from "@typeberry/numbers";
import { MemoryBuilder, Registers, gasCounter, tryAsGas, tryAsMemoryIndex } from "@typeberry/pvm-interpreter";
import { Result } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { Peek } from "./peek";
import { type MachineId, PeekPokeError, tryAsMachineId } from "./refine-externalities";
import { TestRefineExt } from "./refine-externalities.test";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;

describe("HostCalls: Peek", () => {
  it("should request to copy a piece of memory from a running machine", async () => {
    const { peek, registers, memory } = prepareTest(Result.ok(null));
    // when
    await peek.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OK);
  });

  it("should fail if there is no machine", async () => {
    const { peek, registers, memory } = prepareTest(Result.error(PeekPokeError.NoMachine));

    // when
    await peek.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.WHO);
  });

  it("should fail if there is a page fault on any side", async () => {
    const { peek, registers, memory } = prepareTest(Result.error(PeekPokeError.PageFault));

    // when
    await peek.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
  });
});

function prepareRegsAndMemory(machineId: MachineId, destinationStart: number, sourceStart: number, length: number) {
  const registers = new Registers();
  registers.asUnsigned[7] = machineId;
  registers.asUnsigned[8] = destinationStart;
  registers.asUnsigned[9] = sourceStart;
  registers.asUnsigned[10] = length;

  const builder = new MemoryBuilder();
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsMemoryIndex(0));

  return {
    registers,
    memory,
  };
}

function prepareTest(result: Result<null, PeekPokeError>) {
  const refine = new TestRefineExt();
  const peek = new Peek(refine);
  peek.currentServiceId = tryAsServiceId(10_000);
  const machineId = tryAsMachineId(10_000);
  const { registers, memory } = prepareRegsAndMemory(machineId, 10_000, 15_000, 128);
  refine.machinePeekData.set(
    result,
    machineId,
    tryAsMemoryIndex(10_000),
    tryAsMemoryIndex(15_000),
    tryAsU32(128),
    memory,
  );

  return {
    peek,
    registers,
    memory,
  };
}
