import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { MemoryBuilder, Registers, gasCounter, tryAsGas } from "@typeberry/pvm-interpreter";
import { tryAsMemoryIndex, tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index.js";
import { Compatibility, GpVersion, OK, Result } from "@typeberry/utils";
import { type MachineId, ZeroVoidError, tryAsMachineId } from "../externalities/refine-externalities.js";
import { TestRefineExt } from "../externalities/refine-externalities.test.js";
import { HostCallResult } from "../results.js";
import { Zero } from "./zero.js";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;

function prepareRegsAndMemory(machineId: MachineId, pageStart: number, pageCount: number) {
  const registers = new HostCallRegisters(new Registers());
  registers.set(7, machineId);
  registers.set(8, tryAsU64(pageStart));
  registers.set(9, tryAsU64(pageCount));

  const builder = new MemoryBuilder();
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0));

  return {
    registers,
    memory: new HostCallMemory(memory),
  };
}

function prepareTest(result: Result<OK, ZeroVoidError>, pageStart: number, pageCount: number) {
  const refine = new TestRefineExt();
  const zero = new Zero(refine);
  zero.currentServiceId = tryAsServiceId(10_000);
  const machineId = tryAsMachineId(10_000);
  const { registers, memory } = prepareRegsAndMemory(machineId, pageStart, pageCount);
  refine.machineZeroPagesData.set(result, machineId, tryAsU64(pageStart), tryAsU64(pageCount));

  return {
    zero,
    registers,
    memory,
  };
}

describe("HostCalls: Zero", () => {
  const itPre067 = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7) ? it.skip : it;

  itPre067("should return OK and set memory readable and zeroed", async () => {
    const { zero, registers } = prepareTest(Result.ok(OK), 10_000, 5);

    // when
    const result = await zero.execute(gas, registers);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
  });

  itPre067("should return HUH when page is too low", async () => {
    const { zero, registers } = prepareTest(Result.error(ZeroVoidError.InvalidPage), 12, 5);

    // when
    const result = await zero.execute(gas, registers);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
  });

  itPre067("should return HUH when page is too large", async () => {
    const { zero, registers } = prepareTest(Result.error(ZeroVoidError.InvalidPage), 2 ** 32 - 1, 12_000);

    // when
    const result = await zero.execute(gas, registers);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
  });

  itPre067("should return HUH when page is too large 2", async () => {
    const { zero, registers } = prepareTest(Result.error(ZeroVoidError.InvalidPage), 2 ** 20 - 5, 5);

    // when
    const result = await zero.execute(gas, registers);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
  });

  itPre067("should return WHO if machine is not known", async () => {
    const { zero, registers } = prepareTest(Result.error(ZeroVoidError.NoMachine), 10_000, 5);

    // when
    const result = await zero.execute(gas, registers);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.WHO);
  });
});
