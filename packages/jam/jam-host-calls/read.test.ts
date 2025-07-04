import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { blake2b } from "@typeberry/hash";
import { tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution } from "@typeberry/pvm-host-calls/host-call-handler.js";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas.js";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/index.js";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index.js";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts.js";
import { OK, Result } from "@typeberry/utils";
import { Read } from "./read.js";
import { HostCallResult } from "./results.js";
import { TestAccounts } from "./test-accounts.js";
import { SERVICE_ID_BYTES, writeServiceIdAsLeBytes } from "./utils.js";

const gas = gasCounter(tryAsGas(0));
const SERVICE_ID_REG = 7;
const RESULT_REG = SERVICE_ID_REG;
const KEY_START_REG = 8;
const KEY_LEN_REG = 9;
const DEST_START_REG = 10;
const VALUE_OFFSET_REG = 11;
const VALUE_LENGTH_TO_WRITE_REG = 12;

function prepareKey(serviceId: ServiceId, key: string) {
  const keyBytes = BytesBlob.blobFromString(key);
  const serviceIdAndKey = new Uint8Array(SERVICE_ID_BYTES + keyBytes.length);
  writeServiceIdAsLeBytes(serviceId, serviceIdAndKey);
  serviceIdAndKey.set(keyBytes.raw, SERVICE_ID_BYTES);
  return { key: keyBytes, hash: blake2b.hashBytes(serviceIdAndKey) };
}

function prepareRegsAndMemory(
  key: BytesBlob,
  valueLength: number,
  {
    skipKey = false,
    skipValue = false,
    valueOffset = 0,
    valueLengthToWrite = valueLength,
    serviceId,
  }: {
    skipKey?: boolean;
    skipValue?: boolean;
    valueOffset?: number;
    valueLengthToWrite?: number;
    serviceId?: ServiceId;
  } = {},
) {
  const keyAddress = 2 ** 20;
  const memStart = 2 ** 16;
  const registers = new HostCallRegisters(new Registers());
  if (serviceId !== undefined) {
    registers.set(SERVICE_ID_REG, tryAsU64(serviceId));
  } else {
    registers.set(SERVICE_ID_REG, tryAsU64(2n ** 64n - 1n));
  }
  registers.set(KEY_START_REG, tryAsU64(keyAddress));
  registers.set(KEY_LEN_REG, tryAsU64(key.length));
  registers.set(DEST_START_REG, tryAsU64(memStart));
  registers.set(VALUE_OFFSET_REG, tryAsU64(valueOffset));
  registers.set(VALUE_LENGTH_TO_WRITE_REG, tryAsU64(valueLengthToWrite));

  const builder = new MemoryBuilder();
  if (!skipKey) {
    builder.setReadablePages(tryAsMemoryIndex(keyAddress), tryAsMemoryIndex(keyAddress + PAGE_SIZE), key.raw);
  }
  if (!skipValue) {
    builder.setWriteablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + PAGE_SIZE));
  }
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory: new HostCallMemory(memory),
    readResult: () => {
      const result = new Uint8Array(valueLength - valueOffset);
      assert.deepStrictEqual(memory.loadInto(result, tryAsMemoryIndex(memStart)), Result.ok(OK));
      return BytesBlob.blobFrom(result);
    },
  };
}

describe("HostCalls: Read", () => {
  describe("should read key from an account state", () => {
    it("for current account", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const accounts = new TestAccounts(currentServiceId);
      const read = new Read(currentServiceId, accounts);
      const serviceId = tryAsServiceId(10_000);
      const { key, hash } = prepareKey(read.currentServiceId, "key");
      const value = "hello world";
      const { registers, memory, readResult } = prepareRegsAndMemory(key, value.length);
      accounts.storage.set(BytesBlob.blobFromString(value), serviceId, hash);

      const result = read.execute(gas, registers, memory);

      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), tryAsU64(value.length));
      assert.deepStrictEqual(readResult().asText(), value);
    });

    it("for different service Id", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const accounts = new TestAccounts(currentServiceId);
      const read = new Read(currentServiceId, accounts);
      const serviceId = tryAsServiceId(11_000);
      const { key, hash } = prepareKey(serviceId, "key");
      const value = "hello world";
      const { registers, memory, readResult } = prepareRegsAndMemory(key, value.length, {
        serviceId,
      });
      accounts.storage.set(BytesBlob.blobFromString(value), serviceId, hash);

      const result = read.execute(gas, registers, memory);

      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), tryAsU64(value.length));
      assert.deepStrictEqual(readResult().asText(), value);
    });

    it("with offset", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const accounts = new TestAccounts(currentServiceId);
      const read = new Read(currentServiceId, accounts);
      const serviceId = tryAsServiceId(10_000);
      const { key, hash } = prepareKey(read.currentServiceId, "key");
      const value = "hello world";
      const { registers, memory, readResult } = prepareRegsAndMemory(key, value.length, {
        valueOffset: 6,
      });
      accounts.storage.set(BytesBlob.blobFromString(value), serviceId, hash);

      const result = read.execute(gas, registers, memory);

      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), tryAsU64(value.length));
      assert.deepStrictEqual(readResult().toString(), "0x776f726c64");
    });

    it("with offset and length", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const accounts = new TestAccounts(currentServiceId);
      const read = new Read(currentServiceId, accounts);
      const serviceId = tryAsServiceId(10_000);
      const { key, hash } = prepareKey(read.currentServiceId, "key");
      const value = "hello world";
      const { registers, memory, readResult } = prepareRegsAndMemory(key, value.length, {
        valueOffset: 6,
        valueLengthToWrite: 1,
      });
      accounts.storage.set(BytesBlob.blobFromString(value), serviceId, hash);

      const result = read.execute(gas, registers, memory);

      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), tryAsU64(value.length));
      assert.deepStrictEqual(readResult().toString(), "0x7700000000");
    });

    it("with 0-length destination target", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const accounts = new TestAccounts(currentServiceId);
      const read = new Read(currentServiceId, accounts);
      const serviceId = tryAsServiceId(10_000);
      const { key, hash } = prepareKey(read.currentServiceId, "xyz");
      const value = "hello world";
      const { registers, memory, readResult } = prepareRegsAndMemory(key, value.length, { valueLengthToWrite: 0 });
      accounts.storage.set(BytesBlob.blobFromString(value), serviceId, hash);
      const result = read.execute(gas, registers, memory);

      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), tryAsU64(value.length));
      assert.deepStrictEqual(readResult().toString(), "0x0000000000000000000000");
    });
  });

  it("should handle missing account", () => {
    const currentServiceId = tryAsServiceId(10_000);
    const accounts = new TestAccounts(currentServiceId);
    const read = new Read(currentServiceId, accounts);
    const value = "xyz";
    const { key } = prepareKey(read.currentServiceId, value);
    const { registers, memory } = prepareRegsAndMemory(key, value.length);

    // serviceId out of range
    registers.set(SERVICE_ID_REG, tryAsU64(2n ** 32n));

    const result = read.execute(gas, registers, memory);

    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(SERVICE_ID_REG), HostCallResult.NONE);
  });

  it("should handle missing value", () => {
    const currentServiceId = tryAsServiceId(10_000);
    const accounts = new TestAccounts(currentServiceId);
    const read = new Read(currentServiceId, accounts);
    const serviceId = tryAsServiceId(10_000);
    const value = "xyz";
    const { key, hash } = prepareKey(read.currentServiceId, value);
    const { registers, memory, readResult } = prepareRegsAndMemory(key, value.length);
    accounts.storage.set(null, serviceId, hash);

    const result = read.execute(gas, registers, memory);

    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.NONE);
    assert.deepStrictEqual(readResult().toString(), "0x000000");
  });

  it("should fail if there is no memory for key", () => {
    const currentServiceId = tryAsServiceId(10_000);
    const accounts = new TestAccounts(currentServiceId);
    const read = new Read(currentServiceId, accounts);
    const serviceId = tryAsServiceId(10_000);
    const value = "xyz";
    const { key, hash } = prepareKey(read.currentServiceId, value);
    const { registers, memory } = prepareRegsAndMemory(key, value.length, { skipKey: true });
    accounts.storage.set(BytesBlob.blobFromString("hello world"), serviceId, hash);

    const result = read.execute(gas, registers, memory);
    assert.deepStrictEqual(result, PvmExecution.Panic);
  });

  it("should fail if there is no memory for result", () => {
    const currentServiceId = tryAsServiceId(10_000);
    const accounts = new TestAccounts(currentServiceId);
    const read = new Read(currentServiceId, accounts);
    const serviceId = tryAsServiceId(10_000);
    const value = "xyz";
    const { key, hash } = prepareKey(read.currentServiceId, value);
    const { registers, memory } = prepareRegsAndMemory(key, value.length, { skipValue: true });
    accounts.storage.set(BytesBlob.blobFromString("hello world"), serviceId, hash);

    const result = read.execute(gas, registers, memory);
    assert.deepStrictEqual(result, PvmExecution.Panic);
  });
});
