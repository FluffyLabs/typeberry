import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceGas, type ServiceId, tryAsServiceGas, tryAsServiceId } from "@typeberry/block";
import { Encoder, codec } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas.js";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/index.js";
import { PAGE_SIZE } from "@typeberry/pvm-interpreter/memory/memory-consts.js";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index.js";
import { type PerCore, PrivilegedServices, codecPerCore, tryAsPerCore } from "@typeberry/state";
import { Compatibility, GpVersion } from "@typeberry/utils";
import { PartialStateMock } from "../externalities/partial-state-mock.js";
import { HostCallResult } from "../results.js";
import { Bless } from "./bless.js";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;
const MANAGER_REG = 7;
const AUTHORIZATION_REG = 8;
const VALIDATOR_REG = 9;
const DICTIONARY_START = 10;
const DICTIONARY_COUNT = 11;

function prepareServiceGasEntires() {
  const entries = new Array<[ServiceId, ServiceGas]>();
  entries.push([tryAsServiceId(10_000), tryAsServiceGas(15_000)]);
  entries.push([tryAsServiceId(20_000), tryAsServiceGas(15_000)]);
  return entries;
}

if (Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)) {
  function prepareAuthorizers() {
    const authorizers = new Array<ServiceId>();
    authorizers.push(tryAsServiceId(10));
    authorizers.push(tryAsServiceId(15));
    return tryAsPerCore(authorizers, tinyChainSpec);
  }

  function prepareRegsAndMemory(
    entries: [ServiceId, ServiceGas][],
    authorizerData: PerCore<ServiceId>,
    { skipDictionary = false, skipAuth = false }: { skipDictionary?: boolean; skipAuth?: boolean } = {},
  ) {
    const memAuthStart = 2 ** 24;
    const memStart = 2 ** 16;
    const registers = new HostCallRegisters(new Registers());
    registers.set(MANAGER_REG, tryAsU64(5));
    registers.set(AUTHORIZATION_REG, tryAsU64(memAuthStart));
    registers.set(VALIDATOR_REG, tryAsU64(20));
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

    PrivilegedServices;
    const dataAuth = Encoder.encodeObject(codecPerCore(codec.u32.asOpaque<ServiceId>()), authorizerData, tinyChainSpec);
    if (!skipAuth) {
      builder.setReadablePages(
        tryAsMemoryIndex(memAuthStart),
        tryAsMemoryIndex(memAuthStart + PAGE_SIZE),
        dataAuth.raw,
      );
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
      const serviceId = tryAsServiceId(10_000);
      const bless = new Bless(serviceId, accumulate, tinyChainSpec);
      const entries = prepareServiceGasEntires();
      const authorizers = prepareAuthorizers();
      const { registers, memory } = prepareRegsAndMemory(entries, authorizers);

      // when
      const result = await bless.execute(gas, registers, memory);

      // then
      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
      assert.deepStrictEqual(accumulate.privilegedServices, [
        [tryAsServiceId(5), [tryAsServiceId(10), tryAsServiceId(15)], tryAsServiceId(20), entries],
      ]);
    });

    it("should return panic when dictionary is not readable", async () => {
      const accumulate = new PartialStateMock();
      const serviceId = tryAsServiceId(10_000);
      const bless = new Bless(serviceId, accumulate, tinyChainSpec);
      const entries = prepareServiceGasEntires();
      const authorizers = prepareAuthorizers();
      const { registers, memory } = prepareRegsAndMemory(entries, authorizers, { skipDictionary: true });

      // when
      const result = await bless.execute(gas, registers, memory);

      // then
      assert.deepStrictEqual(result, PvmExecution.Panic);
      assert.deepStrictEqual(accumulate.privilegedServices, []);
    });

    it("should return panic when authorizers are not readable", async () => {
      const accumulate = new PartialStateMock();
      const serviceId = tryAsServiceId(10_000);
      const bless = new Bless(serviceId, accumulate, tinyChainSpec);
      const entries = prepareServiceGasEntires();
      const authorizers = prepareAuthorizers();
      const { registers, memory } = prepareRegsAndMemory(entries, authorizers, { skipAuth: true });

      // when
      const result = await bless.execute(gas, registers, memory);

      // then
      assert.deepStrictEqual(result, PvmExecution.Panic);
      assert.deepStrictEqual(accumulate.privilegedServices, []);
    });

    it("should auto-accumualte services when dictionary is out of order", async () => {
      const accumulate = new PartialStateMock();
      const serviceId = tryAsServiceId(10_000);
      const bless = new Bless(serviceId, accumulate, tinyChainSpec);
      const entries = prepareServiceGasEntires();
      entries.push([tryAsServiceId(5), tryAsServiceGas(10_000)]);
      const authorizers = prepareAuthorizers();
      const { registers, memory } = prepareRegsAndMemory(entries, authorizers);

      // when
      const result = await bless.execute(gas, registers, memory);

      // then
      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(accumulate.privilegedServices, [
        [tryAsServiceId(5), [tryAsServiceId(10), tryAsServiceId(15)], tryAsServiceId(20), entries],
      ]);
    });

    it("should auto-accumualte services when dictionary contains duplicates", async () => {
      const accumulate = new PartialStateMock();
      const serviceId = tryAsServiceId(10_000);
      const bless = new Bless(serviceId, accumulate, tinyChainSpec);
      const entries = prepareServiceGasEntires();
      entries.push(entries[entries.length - 1]);
      const authorizers = prepareAuthorizers();
      const { registers, memory } = prepareRegsAndMemory(entries, authorizers);

      // when
      const result = await bless.execute(gas, registers, memory);

      // then
      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(accumulate.privilegedServices, [
        [tryAsServiceId(5), [tryAsServiceId(10), tryAsServiceId(15)], tryAsServiceId(20), entries],
      ]);
    });
  });
} else {
  function prepareRegsAndMemory(
    entries: [ServiceId, ServiceGas][],
    { skipDictionary = false }: { skipDictionary?: boolean } = {},
  ) {
    const memStart = 2 ** 16;
    const registers = new HostCallRegisters(new Registers());
    registers.set(MANAGER_REG, tryAsU64(5));
    registers.set(AUTHORIZATION_REG, tryAsU64(10));
    registers.set(VALIDATOR_REG, tryAsU64(15));
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
      const serviceId = tryAsServiceId(10_000);
      const bless = new Bless(serviceId, accumulate, tinyChainSpec);
      const entries = prepareServiceGasEntires();
      const { registers, memory } = prepareRegsAndMemory(entries);

      // when
      const result = await bless.execute(gas, registers, memory);

      // then
      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
      assert.deepStrictEqual(accumulate.privilegedServices, [
        [tryAsServiceId(5), [tryAsServiceId(10), tryAsServiceId(10)], tryAsServiceId(15), entries],
      ]);
    });

    it("should return panic when dictionary is not readable", async () => {
      const accumulate = new PartialStateMock();
      const serviceId = tryAsServiceId(10_000);
      const bless = new Bless(serviceId, accumulate, tinyChainSpec);
      const entries = prepareServiceGasEntires();
      const { registers, memory } = prepareRegsAndMemory(entries, { skipDictionary: true });

      // when
      const result = await bless.execute(gas, registers, memory);

      // then
      assert.deepStrictEqual(result, PvmExecution.Panic);
      assert.deepStrictEqual(accumulate.privilegedServices, []);
    });

    it("should auto-accumualte services when dictionary is out of order", async () => {
      const accumulate = new PartialStateMock();
      const serviceId = tryAsServiceId(10_000);
      const bless = new Bless(serviceId, accumulate, tinyChainSpec);
      const entries = prepareServiceGasEntires();
      entries.push([tryAsServiceId(5), tryAsServiceGas(10_000)]);
      const { registers, memory } = prepareRegsAndMemory(entries);

      // when
      const result = await bless.execute(gas, registers, memory);

      // then
      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(accumulate.privilegedServices, [
        [tryAsServiceId(5), [tryAsServiceId(10), tryAsServiceId(10)], tryAsServiceId(15), entries],
      ]);
    });

    it("should auto-accumualte services when dictionary contains duplicates", async () => {
      const accumulate = new PartialStateMock();
      const serviceId = tryAsServiceId(10_000);
      const bless = new Bless(serviceId, accumulate, tinyChainSpec);
      const entries = prepareServiceGasEntires();
      entries.push(entries[entries.length - 1]);
      const { registers, memory } = prepareRegsAndMemory(entries);

      // when
      const result = await bless.execute(gas, registers, memory);

      // then
      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(accumulate.privilegedServices, [
        [tryAsServiceId(5), [tryAsServiceId(10), tryAsServiceId(10)], tryAsServiceId(15), entries],
      ]);
    });
  });
}
