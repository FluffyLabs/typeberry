import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { tryAsU32 } from "@typeberry/numbers";
import { MemoryBuilder, Registers, gasCounter, tryAsGas, tryAsMemoryIndex } from "@typeberry/pvm-interpreter";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { OK, Result } from "@typeberry/utils";
import { LegacyHostCallResult } from "../results";
import { type MachineId, tryAsMachineId } from "./machine-instance";
import { Poke } from "./poke";
import { PeekPokeError } from "./refine-externalities";
import { TestRefineExt } from "./refine-externalities.test";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;

describe("HostCalls: Poke", () => {
  it("should request to copy a piece of memory into a running machine", async () => {
    const { poke, registers, memory } = prepareTest(Result.ok(OK));
    // when
    await poke.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.OK);
  });

  it("should fail if machine does not exist", async () => {
    const { poke, registers, memory } = prepareTest(Result.error(PeekPokeError.NoMachine));

    // when
    await poke.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.WHO);
  });

  it("should fail if there is a page fault on any side", async () => {
    const { poke, registers, memory } = prepareTest(Result.error(PeekPokeError.PageFault));

    // when
    await poke.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.OOB);
  });
});

function prepareRegsAndMemory(machineId: MachineId, sourceStart: number, destinationStart: number, length: number) {
  const registers = new Registers();
  registers.setU64(7, machineId);
  registers.setU32(8, sourceStart);
  registers.setU32(9, destinationStart);
  registers.setU32(10, length);

  const builder = new MemoryBuilder();
  const memory = builder.finalize(tryAsSbrkIndex(0), tryAsSbrkIndex(0));

  return {
    registers,
    memory,
  };
}

function prepareTest(result: Result<OK, PeekPokeError>) {
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
