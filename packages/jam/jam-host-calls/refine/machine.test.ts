import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { PvmExecution } from "@typeberry/pvm-host-calls";
import { MemoryBuilder, Registers, gasCounter, tryAsGas, tryAsMemoryIndex } from "@typeberry/pvm-interpreter";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { HostCallResult } from "../results";
import { Machine } from "./machine";
import { type ProgramCounter, tryAsMachineId, tryAsProgramCounter } from "./refine-externalities";
import { TestRefineExt } from "./refine-externalities.test";

const gas = gasCounter(tryAsGas(0));
const CODE_START_REG = 7;
const RESULT_REG = CODE_START_REG;
const CODE_LEN_REG = 8;
const PC_REG = 9;

function prepareRegsAndMemory(code: BytesBlob, pc: ProgramCounter, { skipCode = false }: { skipCode?: boolean } = {}) {
  const memStart = 2 ** 20;
  const registers = new Registers();
  registers.setU32(CODE_START_REG, memStart);
  registers.setU32(CODE_LEN_REG, code.length);
  registers.setU64(PC_REG, pc);

  const builder = new MemoryBuilder();
  if (!skipCode) {
    builder.setReadablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + PAGE_SIZE), code.raw);
  }
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory,
  };
}

describe("HostCalls: Machine", () => {
  it("should start a new nested machine with minimal code", async () => {
    const refine = new TestRefineExt();
    const machine = new Machine(refine);
    const machineId = tryAsMachineId(10_000);
    machine.currentServiceId = tryAsServiceId(10_000);
    const code = BytesBlob.blobFromNumbers([0, 0, 0]);
    const programCounter = tryAsProgramCounter(5);
    const { registers, memory } = prepareRegsAndMemory(code, programCounter);
    refine.machineStartData.set(machineId, code, programCounter);

    // when
    const result = await machine.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG), machineId);
  });

  it("should start a new nested machine with fibbonacci code", async () => {
    const refine = new TestRefineExt();
    const machine = new Machine(refine);
    const machineId = tryAsMachineId(10_000);
    machine.currentServiceId = tryAsServiceId(10_000);
    const code = BytesBlob.blobFromNumbers([
      0, 0, 33, 51, 8, 1, 51, 9, 1, 40, 3, 0, 149, 119, 255, 81, 7, 12, 100, 138, 200, 152, 8, 100, 169, 40, 243, 100,
      135, 51, 8, 51, 9, 1, 50, 0, 73, 147, 82, 213, 0,
    ]);
    const programCounter = tryAsProgramCounter(5);
    const { registers, memory } = prepareRegsAndMemory(code, programCounter);
    refine.machineStartData.set(machineId, code, programCounter);

    // when
    const result = await machine.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG), machineId);
  });

  it("should panic when code is unavailable", async () => {
    const refine = new TestRefineExt();
    const machine = new Machine(refine);
    machine.currentServiceId = tryAsServiceId(10_000);
    const code = BytesBlob.blobFromString("amazing PVM code");
    const programCounter = tryAsProgramCounter(5);
    const { registers, memory } = prepareRegsAndMemory(code, programCounter, { skipCode: true });

    // when
    const result = await machine.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, PvmExecution.Panic);
  });

  it("should return HUH when code is invalid", async () => {
    const refine = new TestRefineExt();
    const machine = new Machine(refine);
    machine.currentServiceId = tryAsServiceId(10_000);
    const code = BytesBlob.blobFromString("invalid PVM code");
    const programCounter = tryAsProgramCounter(5);
    const { registers, memory } = prepareRegsAndMemory(code, programCounter);

    // when
    const result = await machine.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG), HostCallResult.HUH);
  });
});
