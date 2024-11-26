import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { tryAsU32 } from "@typeberry/numbers";
import { MemoryBuilder, Registers, gasCounter, tryAsGas, tryAsMemoryIndex } from "@typeberry/pvm-interpreter";
import { Result } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { Poke } from "./poke";
import { type MachineId, PeekPokeError, tryAsMachineId } from "./refine-externalities";
import { TestRefineExt } from "./refine-externalities.test";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;

describe("HostCalls: Poke", () => {
  it("should request to copy a piece of memory into a running machine", async () => {
    const { poke, registers, memory } = prepareTest(Result.ok(null));
    // when
    await poke.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OK);
  });

  it("should fail if machine does not exist", async () => {
    const { poke, registers, memory } = prepareTest(Result.error(PeekPokeError.NoMachine));

    // when
    await poke.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.WHO);
  });

  it("should fail if there is a page fault on any side", async () => {
    const { poke, registers, memory } = prepareTest(Result.error(PeekPokeError.PageFault));

    // when
    await poke.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
  });
});

function prepareRegsAndMemory(machineId: MachineId, sourceStart: number, destinationStart: number, length: number) {
  const registers = new Registers();
  registers.asUnsigned[7] = machineId;
  registers.asUnsigned[8] = sourceStart;
  registers.asUnsigned[9] = destinationStart;
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
  const poke = new Poke(refine);
  poke.currentServiceId = tryAsServiceId(10_000);
  const machineId = tryAsMachineId(10_000);
  const { registers, memory } = prepareRegsAndMemory(machineId, 10_000, 15_000, 128);
  refine.machinePokeData.set(
    result,
    machineId,
    tryAsMemoryIndex(10_000),
    tryAsMemoryIndex(15_000),
    tryAsU32(128),
    memory,
  );

  return {
    poke,
    registers,
    memory,
  };
}
