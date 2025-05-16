import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { MemoryBuilder, Registers, gasCounter, tryAsGas } from "@typeberry/pvm-interpreter";
import { tryAsMemoryIndex, tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { OK, Result } from "@typeberry/utils";
import {
  type MachineId,
  tryAsMachineId,
  ZeroVoidError,
} from "../externalities/refine-externalities";
import { TestRefineExt } from "../externalities/refine-externalities.test";
import { HostCallResult } from "../results";
import { Void } from "./void";

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
  const _void = new Void(refine);
  _void.currentServiceId = tryAsServiceId(10_000);
  const machineId = tryAsMachineId(10_000);
  const { registers, memory } = prepareRegsAndMemory(machineId, pageStart, pageCount);
  refine.machineVoidPagesData.set(result, machineId, tryAsU64(pageStart), tryAsU64(pageCount));

  return {
    _void,
    registers,
    memory,
  };
}

describe("HostCalls: Void", () => {
  it("should return OK and void memory", async () => {
    const { _void, registers } = prepareTest(Result.ok(OK), 10_000, 5);

    // when
    const result = await _void.execute(gas, registers);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
  });

  it("should return HUH if invalid page is given", async () => {
    const { _void, registers } = prepareTest(Result.error(ZeroVoidError.InvalidPage), 12, 5);

    // when
    const result = await _void.execute(gas, registers);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
  });

  it("should return HUH when page is too low", async () => {
    const { _void, registers } = prepareTest(Result.error(ZeroVoidError.InvalidPage), 12, 5);

    // when
    const result = await _void.execute(gas, registers);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
  });

  it("should return HUH when page is too large", async () => {
    const { _void, registers } = prepareTest(Result.error(ZeroVoidError.InvalidPage), 2 ** 32 - 1, 12_000);

    // when
    const result = await _void.execute(gas, registers);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
  });

  it("should return HUH when page is too large 2", async () => {
    const { _void, registers } = prepareTest(Result.error(ZeroVoidError.InvalidPage), 2 ** 20 - 5, 5);

    // when
    const result = await _void.execute(gas, registers);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
  });

  it("should fail if machine is not known", async () => {
    const { _void, registers } = prepareTest(Result.error(ZeroVoidError.NoMachine), 10_000, 5);

    // when
    const result = await _void.execute(gas, registers);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.WHO);
  });
});
