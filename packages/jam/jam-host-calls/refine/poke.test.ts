import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { MemoryBuilder, Registers, gasCounter, tryAsGas } from "@typeberry/pvm-interpreter";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { OK, Result } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { Poke } from "./poke";
import { type MachineId, PeekPokeError, tryAsMachineId } from "./refine-externalities";
import { TestRefineExt } from "./refine-externalities.test";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;

function prepareRegsAndMemory(machineId: MachineId, sourceStart: number, destinationStart: number, length: number) {
  const registers = new HostCallRegisters(new Registers());
  registers.set(7, machineId);
  registers.set(8, tryAsU64(sourceStart));
  registers.set(9, tryAsU64(destinationStart));
  registers.set(10, tryAsU64(length));

  const builder = new MemoryBuilder();
  const memory = builder.finalize(tryAsSbrkIndex(0), tryAsSbrkIndex(0));

  return {
    registers,
    memory: new HostCallMemory(memory),
  };
}

function prepareTest(result: Result<OK, PeekPokeError>) {
  const refine = new TestRefineExt();
  const poke = new Poke(refine);
  poke.currentServiceId = tryAsServiceId(10_000);
  const machineId = tryAsMachineId(10_000);
  const memoryStart = 2 ** 20;
  const destinationStart = 2 ** 16;
  const dataLength = 128;
  const { registers, memory } = prepareRegsAndMemory(machineId, memoryStart, destinationStart, dataLength);
  refine.machinePokeData.set(
    result,
    machineId,
    tryAsU64(memoryStart),
    tryAsU64(destinationStart),
    tryAsU64(dataLength),
    memory.getMemory(),
  );

  return {
    poke,
    registers,
    memory,
  };
}

describe("HostCalls: Poke", () => {
  it("should request to copy a piece of memory into a running machine", async () => {
    const { poke, registers, memory } = prepareTest(Result.ok(OK));
    // when
    const result = await poke.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
  });

  it("should return WHO if machine does not exist", async () => {
    const { poke, registers, memory } = prepareTest(Result.error(PeekPokeError.NoMachine));

    // when
    const result = await poke.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.WHO);
  });

  it("should return OOB if there is a page fault on machine side", async () => {
    const { poke, registers, memory } = prepareTest(Result.error(PeekPokeError.DestinationPageFault));

    // when
    const result = await poke.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OOB);
  });

  it("should panic if there is a page fault on source side", async () => {
    const { poke, registers, memory } = prepareTest(Result.error(PeekPokeError.SourcePageFault));

    // when
    const result = await poke.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, PvmExecution.Panic);
  });
});
