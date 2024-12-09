import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { type U32, tryAsU32 } from "@typeberry/numbers";
import { MemoryBuilder, Registers, gasCounter, tryAsGas, tryAsMemoryIndex } from "@typeberry/pvm-interpreter";
import { HostCallResult } from "../results";
import { Machine } from "./machine";
import { tryAsMachineId } from "./refine-externalities";
import { TestRefineExt } from "./refine-externalities.test";

const gas = gasCounter(tryAsGas(0));
const CODE_START_REG = 7;
const RESULT_REG = CODE_START_REG;
const CODE_LEN_REG = 8;
const PC_REG = 9;

function prepareRegsAndMemory(code: BytesBlob, pc: U32, { skipCode = false }: { skipCode?: boolean } = {}) {
  const memStart = 3_400_000;
  const registers = new Registers();
  registers.setU32(CODE_START_REG, memStart);
  registers.setU32(CODE_LEN_REG, code.length);
  registers.setU32(PC_REG, pc);

  const builder = new MemoryBuilder();
  if (!skipCode) {
    builder.setReadable(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + code.length), code.raw);
  }
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsMemoryIndex(0));
  return {
    registers,
    memory,
  };
}

describe("HostCalls: Machine", () => {
  it("should start a new nested machine", async () => {
    const refine = new TestRefineExt();
    const machine = new Machine(refine);
    machine.currentServiceId = tryAsServiceId(10_000);
    const code = BytesBlob.blobFromString("amazing PVM code");
    const { registers, memory } = prepareRegsAndMemory(code, tryAsU32(5));
    refine.machineStartData.set(tryAsMachineId(10_000), code, tryAsU32(5));

    // when
    await machine.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), 10_000);
  });

  it("should fail when code is unavailable", async () => {
    const refine = new TestRefineExt();
    const machine = new Machine(refine);
    machine.currentServiceId = tryAsServiceId(10_000);
    const code = BytesBlob.blobFromString("amazing PVM code");
    const { registers, memory } = prepareRegsAndMemory(code, tryAsU32(5), { skipCode: true });

    // when
    await machine.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), HostCallResult.OOB);
  });
});
