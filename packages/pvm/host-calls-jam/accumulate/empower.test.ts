import assert from "node:assert";
import { describe, it } from "node:test";
import type { ServiceId } from "@typeberry/block";
import { Encoder } from "@typeberry/codec";
import { Registers } from "@typeberry/pvm-interpreter";
import { type Gas, gasCounter } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, createMemoryIndex as memIdx } from "@typeberry/pvm-interpreter/memory";
import { HostCallResult } from "../results";
import { type AccumulationPartialState, Empower } from "./empower";

type CallData = {
  m: ServiceId;
  a: ServiceId;
  v: ServiceId;
  g: Map<ServiceId, Gas>;
};

class TestAccumulate implements AccumulationPartialState {
  public readonly data: CallData[] = [];

  updatePriviligedServices(m: ServiceId, a: ServiceId, v: ServiceId, g: Map<ServiceId, Gas>): void {
    this.data.push({ m, a, v, g });
  }
}

const gas = gasCounter(0 as Gas);
const RESULT_REG = 7;
const SERVICE_M = 7;
const SERVICE_A = 8;
const SERVICE_V = 9;
const DICTIONARY_START = 10;
const DICTIONARY_COUNT = 11;

function prepareDictionary(cb?: (d: Map<ServiceId, Gas>) => void) {
  const dictionary = new Map();
  dictionary.set(10_000 as ServiceId, 15_000 as Gas);
  dictionary.set(20_000 as ServiceId, 15_000 as Gas);
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
  const memStart = 20_000;
  const registers = new Registers();
  registers.asUnsigned[SERVICE_M] = 5 as ServiceId;
  registers.asUnsigned[SERVICE_A] = 10 as ServiceId;
  registers.asUnsigned[SERVICE_V] = 15 as ServiceId;
  registers.asUnsigned[DICTIONARY_START] = memStart;
  registers.asUnsigned[DICTIONARY_COUNT] = dictionary.length;

  const builder = new MemoryBuilder();

  const encoder = Encoder.create();
  for (const [k, v] of dictionary) {
    encoder.i32(k);
    encoder.i64(BigInt(v));
  }
  const data = encoder.viewResult();

  if (!skipDictionary) {
    builder.setReadable(memIdx(memStart), memIdx(memStart + data.buffer.length), data.buffer);
  }
  const memory = builder.finalize(memIdx(0), memIdx(0));
  return {
    registers,
    memory,
  };
}

describe("HostCalls: Empower", () => {
  it("should set new privileged services and auto-accumualte services", async () => {
    const accumulate = new TestAccumulate();
    const empower = new Empower(accumulate);
    const serviceId = 10_000 as ServiceId;
    empower.currentServiceId = serviceId;
    const { flat, expected } = prepareDictionary();
    const { registers, memory } = prepareRegsAndMemory(flat);

    // when
    await empower.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OK);
    assert.deepStrictEqual(accumulate.data, [
      {
        m: 5 as ServiceId,
        a: 10 as ServiceId,
        v: 15 as ServiceId,
        g: expected,
      },
    ]);
  });

  it("should fail when dictionary is not readable", async () => {
    const accumulate = new TestAccumulate();
    const empower = new Empower(accumulate);
    const serviceId = 10_000 as ServiceId;
    empower.currentServiceId = serviceId;
    const { flat } = prepareDictionary();
    const { registers, memory } = prepareRegsAndMemory(flat, { skipDictionary: true });

    // when
    await empower.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
    assert.deepStrictEqual(accumulate.data, []);
  });

  it("should fail when dictionary is out of order", async () => {
    const accumulate = new TestAccumulate();
    const empower = new Empower(accumulate);
    const serviceId = 10_000 as ServiceId;
    empower.currentServiceId = serviceId;
    const { flat } = prepareDictionary((d) => {
      d.set(5 as ServiceId, 10_000 as Gas);
    });
    const { registers, memory } = prepareRegsAndMemory(flat);

    // when
    await empower.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
    assert.deepStrictEqual(accumulate.data, []);
  });

  it("should fail when dictionary contains duplicates", async () => {
    const accumulate = new TestAccumulate();
    const empower = new Empower(accumulate);
    const serviceId = 10_000 as ServiceId;
    empower.currentServiceId = serviceId;
    const { flat } = prepareDictionary();
    flat.push(flat[flat.length - 1]);
    const { registers, memory } = prepareRegsAndMemory(flat);

    // when
    await empower.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
    assert.deepStrictEqual(accumulate.data, []);
  });
});
