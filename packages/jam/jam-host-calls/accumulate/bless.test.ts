import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceGas, type ServiceId, tryAsServiceGas, tryAsServiceId } from "@typeberry/block";
import { Encoder } from "@typeberry/codec";
import { tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { PAGE_SIZE } from "@typeberry/pvm-interpreter/memory/memory-consts";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { PartialStateMock } from "../externalities/partial-state-mock";
import { HostCallResult } from "../results";
import { Bless } from "./bless";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;
const SERVICE_M = 7;
const SERVICE_A = 8;
const SERVICE_V = 9;
const DICTIONARY_START = 10;
const DICTIONARY_COUNT = 11;

function prepareServiceGasEntires() {
  const entries = new Array<[ServiceId, ServiceGas]>();
  entries.push([tryAsServiceId(10_000), tryAsServiceGas(15_000)]);
  entries.push([tryAsServiceId(20_000), tryAsServiceGas(15_000)]);
  return entries;
}

function prepareRegsAndMemory(
  entries: [ServiceId, ServiceGas][],
  { skipDictionary = false }: { skipDictionary?: boolean } = {},
) {
  const memStart = 2 ** 16;
  const registers = new HostCallRegisters(new Registers());
  registers.set(SERVICE_M, tryAsU64(5));
  registers.set(SERVICE_A, tryAsU64(10));
  registers.set(SERVICE_V, tryAsU64(15));
  registers.set(DICTIONARY_START, tryAsU64(memStart));
  registers.set(DICTIONARY_COUNT, tryAsU64(entries.length));

  const builder = new MemoryBuilder();

  const encoder = Encoder.create();
  for (const [k, v] of entries) {
    encoder.i32(k);
    encoder.i64(v);
  }
  const data = encoder.viewResult();

  if (!skipDictionary) {
    builder.setReadablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + PAGE_SIZE), data.raw);
  }
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory: new HostCallMemory(memory),
  };
}

describe("HostCalls: Bless", () => {
  it("should set new privileged services and auto-accumualte services", async () => {
    const accumulate = new PartialStateMock();
    const bless = new Bless(accumulate);
    const serviceId = tryAsServiceId(10_000);
    bless.currentServiceId = serviceId;
    const entries = prepareServiceGasEntires();
    const { registers, memory } = prepareRegsAndMemory(entries);

    // when
    const result = await bless.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    assert.deepStrictEqual(accumulate.privilegedServices, [
      [tryAsServiceId(5), tryAsServiceId(10), tryAsServiceId(15), entries],
    ]);
  });

  it("should return panic when dictionary is not readable", async () => {
    const accumulate = new PartialStateMock();
    const empower = new Bless(accumulate);
    const serviceId = tryAsServiceId(10_000);
    empower.currentServiceId = serviceId;
    const entries = prepareServiceGasEntires();
    const { registers, memory } = prepareRegsAndMemory(entries, { skipDictionary: true });

    // when
    const result = await empower.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(accumulate.privilegedServices, []);
  });

  it("should auto-accumualte services when dictionary is out of order", async () => {
    const accumulate = new PartialStateMock();
    const empower = new Bless(accumulate);
    const serviceId = tryAsServiceId(10_000);
    empower.currentServiceId = serviceId;
    const entries = prepareServiceGasEntires();
    entries.push([tryAsServiceId(5), tryAsServiceGas(10_000)]);
    const { registers, memory } = prepareRegsAndMemory(entries);

    // when
    const result = await empower.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(accumulate.privilegedServices, [
      [tryAsServiceId(5), tryAsServiceId(10), tryAsServiceId(15), entries],
    ]);
  });

  it("should auto-accumualte services when dictionary contains duplicates", async () => {
    const accumulate = new PartialStateMock();
    const empower = new Bless(accumulate);
    const serviceId = tryAsServiceId(10_000);
    empower.currentServiceId = serviceId;
    const entries = prepareServiceGasEntires();
    entries.push(entries[entries.length - 1]);
    const { registers, memory } = prepareRegsAndMemory(entries);

    // when
    const result = await empower.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(accumulate.privilegedServices, [
      [tryAsServiceId(5), tryAsServiceId(10), tryAsServiceId(15), entries],
    ]);
  });
});
