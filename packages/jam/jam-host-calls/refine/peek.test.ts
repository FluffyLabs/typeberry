import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { tryAsU32 } from "@typeberry/numbers";
import { PvmExecution } from "@typeberry/pvm-host-calls";
import { MemoryBuilder, Registers, gasCounter, tryAsGas, tryAsMemoryIndex } from "@typeberry/pvm-interpreter";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { OK, Result } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { Peek } from "./peek";
import { type MachineId, PeekPokeError, tryAsMachineId } from "./refine-externalities";
import { TestRefineExt } from "./refine-externalities.test";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;

function prepareRegsAndMemory(machineId: MachineId, destinationStart: number, sourceStart: number, length: number) {
  const registers = new Registers();
  registers.setU64(7, machineId);
  registers.setU32(8, destinationStart);
  registers.setU32(9, sourceStart);
  registers.setU32(10, length);

  const builder = new MemoryBuilder();
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0));

  return {
    registers,
    memory,
  };
}

function prepareTest(result: Result<OK, PeekPokeError>) {
  const refine = new TestRefineExt();
  const peek = new Peek(refine);
  peek.currentServiceId = tryAsServiceId(10_000);
  const machineId = tryAsMachineId(10_000);
  const destinationStart = 2 ** 16;
  const memoryStart = 2 ** 20;
  const dataLength = 128;
  const { registers, memory } = prepareRegsAndMemory(machineId, destinationStart, memoryStart, dataLength);
  refine.machinePeekData.set(
    result,
    machineId,
    tryAsMemoryIndex(destinationStart),
    tryAsMemoryIndex(memoryStart),
    tryAsU32(dataLength),
    memory,
  );

  return {
    peek,
    registers,
    memory,
  };
}

describe("HostCalls: Peek", () => {
  it("should request to copy a piece of memory from a running machine", async () => {
    const { peek, registers, memory } = prepareTest(Result.ok(OK));

    // when
    const result = await peek.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG), HostCallResult.OK);
  });

  it("should return WHO if there is no machine", async () => {
    const { peek, registers, memory } = prepareTest(Result.error(PeekPokeError.NoMachine));

    // when
    const result = await peek.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG), HostCallResult.WHO);
  });

  it("should return OOB if there is a page fault on machine side", async () => {
    const { peek, registers, memory } = prepareTest(Result.error(PeekPokeError.DestinationPageFault));

    // when
    const result = await peek.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG), HostCallResult.OOB);
  });

  it("should panic if there is a page fault on source side", async () => {
    const { peek, registers, memory } = prepareTest(Result.error(PeekPokeError.SourcePageFault));

    // when
    const result = await peek.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, PvmExecution.Panic);
  });
});
