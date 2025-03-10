import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { Encoder } from "@typeberry/codec";
import { Registers } from "@typeberry/pvm-interpreter";
import { type Gas, gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { PAGE_SIZE } from "@typeberry/pvm-interpreter/memory/memory-consts";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { LegacyHostCallResult } from "../results";
import { Empower } from "./empower";
import { TestAccumulate } from "./partial-state.test";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;
const SERVICE_M = 7;
const SERVICE_A = 8;
const SERVICE_V = 9;
const DICTIONARY_START = 10;
const DICTIONARY_COUNT = 11;

function prepareDictionary(cb?: (d: Map<ServiceId, Gas>) => void) {
  const dictionary = new Map();
  dictionary.set(tryAsServiceId(10_000), 15_000 as Gas);
  dictionary.set(tryAsServiceId(20_000), 15_000 as Gas);
  if (cb) {
    cb(dictionary);
  }
  return {
    flat: Array.from(dictionary.entries()),
    expected: new Map(Array.from(dictionary.entries()).map(([k, v]) => [k, BigInt(v)])),
  };
}

function prepareRegsAndMemory(
  dictionary: [ServiceId, Gas][],
  { skipDictionary = false }: { skipDictionary?: boolean } = {},
) {
  const memStart = 2 ** 16;
  const registers = new Registers();
  registers.setU32(SERVICE_M, tryAsServiceId(5));
  registers.setU32(SERVICE_A, tryAsServiceId(10));
  registers.setU32(SERVICE_V, tryAsServiceId(15));
  registers.setU32(DICTIONARY_START, memStart);
  registers.setU32(DICTIONARY_COUNT, dictionary.length);

  const builder = new MemoryBuilder();

  const encoder = Encoder.create();
  for (const [k, v] of dictionary) {
    encoder.i32(k);
    encoder.i64(BigInt(v));
  }
  const data = encoder.viewResult();

  if (!skipDictionary) {
    builder.setReadablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + PAGE_SIZE), data.raw);
  }
  const memory = builder.finalize(tryAsSbrkIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory,
  };
}

describe("HostCalls: Empower", () => {
  it("should set new privileged services and auto-accumualte services", async () => {
    const accumulate = new TestAccumulate();
    const empower = new Empower(accumulate);
    const serviceId = tryAsServiceId(10_000);
    empower.currentServiceId = serviceId;
    const { flat, expected } = prepareDictionary();
    const { registers, memory } = prepareRegsAndMemory(flat);

    // when
    await empower.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.OK);
    assert.deepStrictEqual(accumulate.privilegedServices, [
      [tryAsServiceId(5), tryAsServiceId(10), tryAsServiceId(15), expected],
    ]);
  });

  it("should fail when dictionary is not readable", async () => {
    const accumulate = new TestAccumulate();
    const empower = new Empower(accumulate);
    const serviceId = tryAsServiceId(10_000);
    empower.currentServiceId = serviceId;
    const { flat } = prepareDictionary();
    const { registers, memory } = prepareRegsAndMemory(flat, { skipDictionary: true });

    // when
    await empower.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.OOB);
    assert.deepStrictEqual(accumulate.privilegedServices, []);
  });

  it("should fail when dictionary is out of order", async () => {
    const accumulate = new TestAccumulate();
    const empower = new Empower(accumulate);
    const serviceId = tryAsServiceId(10_000);
    empower.currentServiceId = serviceId;
    const { flat } = prepareDictionary((d) => {
      d.set(tryAsServiceId(5), 10_000 as Gas);
    });
    const { registers, memory } = prepareRegsAndMemory(flat);

    // when
    await empower.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.OOB);
    assert.deepStrictEqual(accumulate.privilegedServices, []);
  });

  it("should fail when dictionary contains duplicates", async () => {
    const accumulate = new TestAccumulate();
    const empower = new Empower(accumulate);
    const serviceId = tryAsServiceId(10_000);
    empower.currentServiceId = serviceId;
    const { flat } = prepareDictionary();
    flat.push(flat[flat.length - 1]);
    const { registers, memory } = prepareRegsAndMemory(flat);

    // when
    await empower.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.OOB);
    assert.deepStrictEqual(accumulate.privilegedServices, []);
  });
});
