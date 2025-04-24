import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { tryAsU32 } from "@typeberry/numbers";
import { MemoryBuilder, Registers, gasCounter, tryAsGas } from "@typeberry/pvm-interpreter";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { OK, Result } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { InvalidPageError, type MachineId, NoMachineError, tryAsMachineId } from "./refine-externalities";
import { TestRefineExt } from "./refine-externalities.test";
import { Void } from "./void";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;

function prepareRegsAndMemory(machineId: MachineId, pageStart: number, pageCount: number) {
  const registers = Registers.new();
  registers.setU64(7, machineId);
  registers.setU32(8, pageStart);
  registers.setU32(9, pageCount);

  const builder = new MemoryBuilder();
  const memory = builder.finalize(tryAsSbrkIndex(0), tryAsSbrkIndex(0));

  return {
    registers,
    memory,
  };
}

function prepareTest(result: Result<OK, NoMachineError | InvalidPageError>, pageStart: number, pageCount: number) {
  const refine = new TestRefineExt();
  const _void = new Void(refine);
  _void.currentServiceId = tryAsServiceId(10_000);
  const machineId = tryAsMachineId(10_000);
  const { registers, memory } = prepareRegsAndMemory(machineId, pageStart, pageCount);
  refine.machineVoidPagesData.set(result, machineId, tryAsU32(pageStart), tryAsU32(pageCount));

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
    assert.deepStrictEqual(registers.getU64(RESULT_REG), HostCallResult.OK);
  });

  it("should return HUH if invalid page is given", async () => {
    const { _void, registers } = prepareTest(Result.error(InvalidPageError), 12, 5);

    // when
    const result = await _void.execute(gas, registers);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG), HostCallResult.HUH);
  });

  it("should return HUH when page is too low", async () => {
    const { _void, registers } = prepareTest(Result.ok(OK), 12, 5);

    // when
    const result = await _void.execute(gas, registers);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG), HostCallResult.HUH);
  });

  it("should return HUH when page is too large", async () => {
    const { _void, registers } = prepareTest(Result.ok(OK), 2 ** 32 - 1, 12_000);

    // when
    const result = await _void.execute(gas, registers);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG), HostCallResult.HUH);
  });

  it("should return HUH when page is too large 2", async () => {
    const { _void, registers } = prepareTest(Result.ok(OK), 2 ** 20 - 5, 5);

    // when
    const result = await _void.execute(gas, registers);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG), HostCallResult.HUH);
  });

  it("should fail if machine is not known", async () => {
    const { _void, registers } = prepareTest(Result.error(NoMachineError), 10_000, 5);

    // when
    const result = await _void.execute(gas, registers);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG), HostCallResult.WHO);
  });
});
