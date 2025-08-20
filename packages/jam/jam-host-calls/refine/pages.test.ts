import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { type U64, tryAsU64 } from "@typeberry/numbers";
import { HostCallRegisters } from "@typeberry/pvm-host-calls";
import {
  MemoryBuilder,
  Registers,
  gasCounter,
  tryAsGas,
  tryAsMemoryIndex,
  tryAsSbrkIndex,
} from "@typeberry/pvm-interpreter";
import { Compatibility, GpVersion, OK, Result } from "@typeberry/utils";
import {
  type MachineId,
  PagesError,
  toMemoryOperation,
  tryAsMachineId,
} from "../externalities/refine-externalities.js";
import { TestRefineExt } from "../externalities/refine-externalities.test.js";
import { HostCallResult } from "../results.js";
import { Pages } from "./pages.js";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;

function prepareRegsAndMemory(machineId: MachineId, pageStart: U64, pageCount: U64, requestType: U64) {
  const registers = new HostCallRegisters(new Registers());
  registers.set(7, machineId);
  registers.set(8, pageStart);
  registers.set(9, pageCount);
  registers.set(10, requestType);

  const builder = new MemoryBuilder();
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0));

  return {
    registers,
    memory,
  };
}

function prepareTest(
  result: Result<OK, PagesError>,
  machineId: number,
  pageStart: number,
  pageCount: number,
  requestType: number,
) {
  const refine = new TestRefineExt();
  const pages = new Pages(refine);
  pages.currentServiceId = tryAsServiceId(10_000);
  const machineIndex = tryAsMachineId(machineId);
  const start = tryAsU64(pageStart);
  const count = tryAsU64(pageCount);
  const type = tryAsU64(requestType);
  const { registers, memory } = prepareRegsAndMemory(machineIndex, start, count, type);
  refine.machinePagesData.set(result, machineIndex, start, count, toMemoryOperation(type));

  return {
    pages,
    registers,
    memory,
    refine,
  };
}

describe("HostCalls: Pages", () => {
  const itPost067 = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7) ? it : it.skip;

  itPost067("Should return OK and Void memory", async () => {
    const { pages, registers } = prepareTest(Result.ok(OK), 10_000, 10_000, 5, 0);

    // when
    await pages.execute(gas, registers);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
  });

  itPost067("Should return OK and set Read-only and Zeroed memory", async () => {
    const { pages, registers } = prepareTest(Result.ok(OK), 10_000, 10_000, 5, 1);

    // when
    await pages.execute(gas, registers);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
  });

  itPost067("Should return OK and set Read-write and Zeroed memory", async () => {
    const { pages, registers } = prepareTest(Result.ok(OK), 10_000, 10_000, 5, 2);

    // when
    await pages.execute(gas, registers);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
  });

  itPost067("Should return OK and set Read-only and preserve memory", async () => {
    const { pages, registers } = prepareTest(Result.ok(OK), 10_000, 10_000, 5, 3);

    // when
    await pages.execute(gas, registers);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
  });

  itPost067("Should return OK and set Read-write and preserve memory", async () => {
    const { pages, registers } = prepareTest(Result.ok(OK), 10_000, 10_000, 5, 4);

    // when
    await pages.execute(gas, registers);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
  });

  itPost067("Should return WHO when machine is unknown", async () => {
    const { pages, registers } = prepareTest(Result.error(PagesError.NoMachine), 1, 10_000, 5, 0);

    // when
    await pages.execute(gas, registers);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.WHO);
  });

  itPost067("Should return WHO when provided unknown type request but machine does not exist", async () => {
    // intentionally setting no machine here.
    const { pages, registers } = prepareTest(Result.error(PagesError.NoMachine), 10_000, 10_000, 5, 16);

    // when
    await pages.execute(gas, registers);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.WHO);
  });

  itPost067("Should return HUH when provided unknown type request and machine exist", async () => {
    const { pages, registers } = prepareTest(Result.error(PagesError.InvalidOperation), 10_000, 12, 5, 16);

    // when
    await pages.execute(gas, registers);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
  });

  itPost067("Should return HUH when page is too low", async () => {
    const { pages, registers } = prepareTest(Result.error(PagesError.InvalidPage), 10_000, 12, 5, 0);

    // when
    await pages.execute(gas, registers);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
  });

  itPost067("Should return HUH when page is too large", async () => {
    const { pages, registers } = prepareTest(Result.error(PagesError.InvalidPage), 10_000, 2 ** 32 - 1, 12_000, 2);

    // when
    await pages.execute(gas, registers);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
  });

  itPost067("Should return HUH when page is too large 2", async () => {
    const { pages, registers } = prepareTest(Result.error(PagesError.InvalidPage), 10_000, 2 ** 20 - 5, 5, 3);

    // when
    await pages.execute(gas, registers);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
  });

  itPost067("Should return HUH when attempting to preserve memory of uninitialized page", async () => {
    const { pages, registers } = prepareTest(Result.error(PagesError.InvalidPage), 10_000, 10_000, 5, 3);

    // when
    await pages.execute(gas, registers);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
  });

  itPost067("Should return HUH when attempting to preserve memory of uninitialized page 2", async () => {
    const { pages, registers } = prepareTest(Result.error(PagesError.InvalidPage), 10_000, 10_000, 5, 4);

    // when
    await pages.execute(gas, registers);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
  });
});
