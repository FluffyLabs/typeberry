import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceGas, type ServiceId, tryAsServiceGas, tryAsServiceId } from "@typeberry/block";
import { codec, Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { MAX_VALUE_U32, MAX_VALUE_U64, tryAsU64, type U64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { tryAsGas } from "@typeberry/pvm-interface";
import { gasCounter } from "@typeberry/pvm-interpreter/gas.js";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/index.js";
import { PAGE_SIZE } from "@typeberry/pvm-interpreter/memory/memory-consts.js";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index.js";
import { codecPerCore, type PerCore, tryAsPerCore } from "@typeberry/state";
import { Compatibility, deepEqual, GpVersion, Result } from "@typeberry/utils";
import { UpdatePrivilegesError } from "../externalities/partial-state.js";
import { PartialStateMock } from "../externalities/partial-state-mock.js";
import { HostCallResult } from "../general/results.js";
import { emptyRegistersBuffer } from "../utils.js";
import { Bless } from "./bless.js";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;
const MANAGER_REG = 7;
const AUTHORIZATION_REG = 8;
const VALIDATOR_REG = 9;
const REGISTRAR_REG = 10;
const DICTIONARY_START = Compatibility.isGreaterOrEqual(GpVersion.V0_7_1) ? 11 : 10;
const DICTIONARY_COUNT = Compatibility.isGreaterOrEqual(GpVersion.V0_7_1) ? 12 : 11;

function prepareServiceGasMap() {
  const entries: [ServiceId, ServiceGas][] = [];
  entries.push([tryAsServiceId(10_000), tryAsServiceGas(15_000)]);
  entries.push([tryAsServiceId(20_000), tryAsServiceGas(15_000)]);
  return entries;
}

function prepareAuthorizers() {
  const authorizers: ServiceId[] = [];
  authorizers.push(tryAsServiceId(10));
  authorizers.push(tryAsServiceId(15));
  return tryAsPerCore(authorizers, tinyChainSpec);
}

function prepareRegsAndMemory(
  entries: [ServiceId, ServiceGas][],
  authorizerData: PerCore<ServiceId>,
  {
    skipDictionary = false,
    skipAuth = false,
    manager,
    validator,
    registrar,
  }: { skipDictionary?: boolean; skipAuth?: boolean; manager?: U64; validator?: U64; registrar?: U64 } = {},
) {
  const memAuthStart = 2 ** 24;
  const memStart = 2 ** 16;
  const registers = new HostCallRegisters(emptyRegistersBuffer());
  registers.set(MANAGER_REG, manager ?? tryAsU64(5));
  registers.set(AUTHORIZATION_REG, tryAsU64(memAuthStart));
  registers.set(VALIDATOR_REG, validator ?? tryAsU64(20));
  registers.set(REGISTRAR_REG, registrar ?? tryAsU64(42));
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

  const dataAuth = Encoder.encodeObject(codecPerCore(codec.u32.asOpaque<ServiceId>()), authorizerData, tinyChainSpec);
  if (!skipAuth) {
    builder.setReadablePages(tryAsMemoryIndex(memAuthStart), tryAsMemoryIndex(memAuthStart + PAGE_SIZE), dataAuth.raw);
  }

  const memory = new HostCallMemory(builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0)));
  return {
    registers,
    memory,
  };
}
describe("HostCalls: Bless", () => {
  const itPost071 = Compatibility.isGreaterOrEqual(GpVersion.V0_7_1) ? it : it.skip;

  it("should set new privileged services and auto-accumulate services", async () => {
    const accumulate = new PartialStateMock();
    const serviceId = tryAsServiceId(10_000);
    const bless = new Bless(serviceId, accumulate, tinyChainSpec);
    const entries = prepareServiceGasMap();
    const authorizers = prepareAuthorizers();
    const { registers, memory } = prepareRegsAndMemory(entries, authorizers);

    // when
    const result = await bless.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    if (Compatibility.isGreaterOrEqual(GpVersion.V0_7_1)) {
      deepEqual(accumulate.privilegedServices, [
        [
          tryAsServiceId(5),
          tryAsPerCore([tryAsServiceId(10), tryAsServiceId(15)], tinyChainSpec),
          tryAsServiceId(20),
          tryAsServiceId(42),
          new Map(entries),
        ],
      ]);
    } else {
      deepEqual(accumulate.privilegedServices, [
        [
          tryAsServiceId(5),
          tryAsPerCore([tryAsServiceId(10), tryAsServiceId(15)], tinyChainSpec),
          tryAsServiceId(20),
          tryAsServiceId(MAX_VALUE_U32),
          new Map(entries),
        ],
      ]);
    }
  });

  it("should return panic when dictionary is not readable", async () => {
    const accumulate = new PartialStateMock();
    const serviceId = tryAsServiceId(10_000);
    const bless = new Bless(serviceId, accumulate, tinyChainSpec);
    const entries = prepareServiceGasMap();
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
    const entries = prepareServiceGasMap();
    const authorizers = prepareAuthorizers();
    const { registers, memory } = prepareRegsAndMemory(entries, authorizers, { skipAuth: true });

    // when
    const result = await bless.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(accumulate.privilegedServices, []);
  });

  it("should auto-accumulate services when dictionary is out of order", async () => {
    const accumulate = new PartialStateMock();
    const serviceId = tryAsServiceId(10_000);
    const bless = new Bless(serviceId, accumulate, tinyChainSpec);
    const entries = prepareServiceGasMap();
    entries.push([tryAsServiceId(5), tryAsServiceGas(10_000)]);
    const authorizers = prepareAuthorizers();
    const { registers, memory } = prepareRegsAndMemory(entries, authorizers);

    // when
    const result = await bless.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    if (Compatibility.isGreaterOrEqual(GpVersion.V0_7_1)) {
      deepEqual(accumulate.privilegedServices, [
        [
          tryAsServiceId(5),
          tryAsPerCore([tryAsServiceId(10), tryAsServiceId(15)], tinyChainSpec),
          tryAsServiceId(20),
          tryAsServiceId(42),
          new Map(entries),
        ],
      ]);
    } else {
      deepEqual(accumulate.privilegedServices, [
        [
          tryAsServiceId(5),
          tryAsPerCore([tryAsServiceId(10), tryAsServiceId(15)], tinyChainSpec),
          tryAsServiceId(20),
          tryAsServiceId(MAX_VALUE_U32),
          new Map(entries),
        ],
      ]);
    }
  });

  it("should auto-accumulate services when dictionary contains duplicates", async () => {
    const accumulate = new PartialStateMock();
    const serviceId = tryAsServiceId(10_000);
    const bless = new Bless(serviceId, accumulate, tinyChainSpec);
    const entries = prepareServiceGasMap();
    entries.push(entries[entries.length - 1]);
    const authorizers = prepareAuthorizers();
    const { registers, memory } = prepareRegsAndMemory(entries, authorizers);

    // when
    const result = await bless.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    if (Compatibility.isGreaterOrEqual(GpVersion.V0_7_1)) {
      deepEqual(accumulate.privilegedServices, [
        [
          tryAsServiceId(5),
          tryAsPerCore([tryAsServiceId(10), tryAsServiceId(15)], tinyChainSpec),
          tryAsServiceId(20),
          tryAsServiceId(42),
          new Map(entries),
        ],
      ]);
    } else {
      deepEqual(accumulate.privilegedServices, [
        [
          tryAsServiceId(5),
          tryAsPerCore([tryAsServiceId(10), tryAsServiceId(15)], tinyChainSpec),
          tryAsServiceId(20),
          tryAsServiceId(MAX_VALUE_U32),
          new Map(entries),
        ],
      ]);
    }
  });

  it("should return HUH when service is unprivileged", async () => {
    const accumulate = new PartialStateMock();
    accumulate.privilegedServicesResponse = Result.error(
      UpdatePrivilegesError.UnprivilegedService,
      () => "Test: unprivileged service attempting bless",
    );
    const serviceId = tryAsServiceId(11_000);
    const bless = new Bless(serviceId, accumulate, tinyChainSpec);
    const entries = prepareServiceGasMap();
    const authorizers = prepareAuthorizers();
    const { registers, memory } = prepareRegsAndMemory(entries, authorizers);

    // when
    const result = await bless.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.HUH);
    assert.deepStrictEqual(accumulate.privilegedServices, []);
  });

  it("should return WHO if given manager is invalid", async () => {
    const accumulate = new PartialStateMock();
    accumulate.privilegedServicesResponse = Result.error(
      UpdatePrivilegesError.InvalidServiceId,
      () => "Test: invalid manager service ID for bless",
    );
    const serviceId = tryAsServiceId(11_000);
    const bless = new Bless(serviceId, accumulate, tinyChainSpec);
    const entries = prepareServiceGasMap();
    const authorizers = prepareAuthorizers();
    const { registers, memory } = prepareRegsAndMemory(entries, authorizers, { manager: tryAsU64(MAX_VALUE_U64) });

    // when
    const result = await bless.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.WHO);
    assert.deepStrictEqual(accumulate.privilegedServices, []);
  });

  it("should return WHO if given validator is invalid", async () => {
    const accumulate = new PartialStateMock();
    accumulate.privilegedServicesResponse = Result.error(
      UpdatePrivilegesError.InvalidServiceId,
      () => "Test: invalid validator service ID for bless",
    );
    const serviceId = tryAsServiceId(11_000);
    const bless = new Bless(serviceId, accumulate, tinyChainSpec);
    const entries = prepareServiceGasMap();
    const authorizers = prepareAuthorizers();
    const { registers, memory } = prepareRegsAndMemory(entries, authorizers, { validator: tryAsU64(MAX_VALUE_U64) });

    // when
    const result = await bless.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.WHO);
    assert.deepStrictEqual(accumulate.privilegedServices, []);
  });

  itPost071("should return WHO if given registrar is invalid", async () => {
    const accumulate = new PartialStateMock();
    accumulate.privilegedServicesResponse = Result.error(
      UpdatePrivilegesError.InvalidServiceId,
      () => "Test: invalid registrar service ID for bless",
    );
    const serviceId = tryAsServiceId(11_000);
    const bless = new Bless(serviceId, accumulate, tinyChainSpec);
    const entries = prepareServiceGasMap();
    const authorizers = prepareAuthorizers();
    const { registers, memory } = prepareRegsAndMemory(entries, authorizers, { registrar: tryAsU64(MAX_VALUE_U64) });

    // when
    const result = await bless.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.WHO);
    assert.deepStrictEqual(accumulate.privilegedServices, []);
  });
});
