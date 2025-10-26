import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { tryAsGas } from "@typeberry/pvm-interface";
import { gasCounter } from "@typeberry/pvm-interpreter";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/index.js";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index.js";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts.js";
import { asOpaqueType, OK, Result } from "@typeberry/utils";
import { TestAccounts } from "./externalities/test-accounts.js";
import { Read } from "./read.js";
import { HostCallResult } from "./results.js";
import { emptyRegistersBuffer } from "./utils.js";

const gas = gasCounter(tryAsGas(0));
const SERVICE_ID_REG = 7;
const RESULT_REG = SERVICE_ID_REG;
const KEY_START_REG = 8;
const KEY_LEN_REG = 9;
const DEST_START_REG = 10;
const VALUE_OFFSET_REG = 11;
const VALUE_LENGTH_TO_WRITE_REG = 12;

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
  const registers = new HostCallRegisters(emptyRegistersBuffer());
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
  const memory = new HostCallMemory(builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0)));
  return {
    registers,
    memory,
    readResult: () => {
      const result = new Uint8Array(valueLength - valueOffset);
      assert.deepStrictEqual(memory.loadInto(result, tryAsU64(memStart)), Result.ok(OK));
      return BytesBlob.blobFrom(result);
    },
  };
}

describe("HostCalls: Read", () => {
  describe("should read key from an account state", () => {
    it("for current account", async () => {
      const currentServiceId = tryAsServiceId(10_000);
      const accounts = new TestAccounts(currentServiceId);
      const read = new Read(currentServiceId, accounts);
      const serviceId = tryAsServiceId(10_000);
      const key = BytesBlob.blobFromString("key");
      const value = "hello world";
      const { registers, memory, readResult } = prepareRegsAndMemory(key, value.length);
      accounts.storage.set(BytesBlob.blobFromString(value), serviceId, asOpaqueType(key));

      const result = await read.execute(gas, registers, memory);

      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), tryAsU64(value.length));
      assert.deepStrictEqual(readResult().asText(), value);
    });

    it("for different service Id", async () => {
      const currentServiceId = tryAsServiceId(10_000);
      const accounts = new TestAccounts(currentServiceId);
      const read = new Read(currentServiceId, accounts);
      const serviceId = tryAsServiceId(11_000);
      const key = BytesBlob.blobFromString("key");
      const value = "hello world";
      const { registers, memory, readResult } = prepareRegsAndMemory(key, value.length, {
        serviceId,
      });
      accounts.storage.set(BytesBlob.blobFromString(value), serviceId, asOpaqueType(key));

      const result = await read.execute(gas, registers, memory);

      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), tryAsU64(value.length));
      assert.deepStrictEqual(readResult().asText(), value);
    });

    it("with offset", async () => {
      const currentServiceId = tryAsServiceId(10_000);
      const accounts = new TestAccounts(currentServiceId);
      const read = new Read(currentServiceId, accounts);
      const serviceId = tryAsServiceId(10_000);
      const key = BytesBlob.blobFromString("key");
      const value = "hello world";
      const { registers, memory, readResult } = prepareRegsAndMemory(key, value.length, {
        valueOffset: 6,
      });
      accounts.storage.set(BytesBlob.blobFromString(value), serviceId, asOpaqueType(key));

      const result = await read.execute(gas, registers, memory);

      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), tryAsU64(value.length));
      assert.deepStrictEqual(readResult().toString(), "0x776f726c64");
    });

    it("with offset and length", async () => {
      const currentServiceId = tryAsServiceId(10_000);
      const accounts = new TestAccounts(currentServiceId);
      const read = new Read(currentServiceId, accounts);
      const serviceId = tryAsServiceId(10_000);
      const key = BytesBlob.blobFromString("key");
      const value = "hello world";
      const { registers, memory, readResult } = prepareRegsAndMemory(key, value.length, {
        valueOffset: 6,
        valueLengthToWrite: 1,
      });
      accounts.storage.set(BytesBlob.blobFromString(value), serviceId, asOpaqueType(key));

      const result = await read.execute(gas, registers, memory);

      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), tryAsU64(value.length));
      assert.deepStrictEqual(readResult().toString(), "0x7700000000");
    });

    it("with 0-length destination target", async () => {
      const currentServiceId = tryAsServiceId(10_000);
      const accounts = new TestAccounts(currentServiceId);
      const read = new Read(currentServiceId, accounts);
      const serviceId = tryAsServiceId(10_000);
      const key = BytesBlob.blobFromString("xyz");
      const value = "hello world";
      const { registers, memory, readResult } = prepareRegsAndMemory(key, value.length, { valueLengthToWrite: 0 });
      accounts.storage.set(BytesBlob.blobFromString(value), serviceId, asOpaqueType(key));
      const result = await read.execute(gas, registers, memory);

      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), tryAsU64(value.length));
      assert.deepStrictEqual(readResult().toString(), "0x0000000000000000000000");
    });
  });

  it("should handle missing account", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const accounts = new TestAccounts(currentServiceId);
    const read = new Read(currentServiceId, accounts);
    const value = "xyz";
    const key = BytesBlob.blobFromString(value);
    const { registers, memory } = prepareRegsAndMemory(key, value.length);

    // serviceId out of range
    registers.set(SERVICE_ID_REG, tryAsU64(2n ** 32n));

    const result = await read.execute(gas, registers, memory);

    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(SERVICE_ID_REG), HostCallResult.NONE);
  });

  it("should handle missing value", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const accounts = new TestAccounts(currentServiceId);
    const read = new Read(currentServiceId, accounts);
    const serviceId = tryAsServiceId(10_000);
    const value = "xyz";
    const key = BytesBlob.blobFromString(value);
    const { registers, memory, readResult } = prepareRegsAndMemory(key, value.length);
    accounts.storage.set(null, serviceId, asOpaqueType(key));

    const result = await read.execute(gas, registers, memory);

    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.NONE);
    assert.deepStrictEqual(readResult().toString(), "0x000000");
  });

  it("should fail if there is no memory for key", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const accounts = new TestAccounts(currentServiceId);
    const read = new Read(currentServiceId, accounts);
    const serviceId = tryAsServiceId(10_000);
    const value = "xyz";
    const key = BytesBlob.blobFromString(value);
    const { registers, memory } = prepareRegsAndMemory(key, value.length, { skipKey: true });
    accounts.storage.set(BytesBlob.blobFromString("hello world"), serviceId, asOpaqueType(key));

    const result = await read.execute(gas, registers, memory);
    assert.deepStrictEqual(result, PvmExecution.Panic);
  });

  it("should fail if there is no memory for result", async () => {
    const currentServiceId = tryAsServiceId(10_000);
    const accounts = new TestAccounts(currentServiceId);
    const read = new Read(currentServiceId, accounts);
    const serviceId = tryAsServiceId(10_000);
    const value = "xyz";
    const key = BytesBlob.blobFromString(value);
    const { registers, memory } = prepareRegsAndMemory(key, value.length, { skipValue: true });
    accounts.storage.set(BytesBlob.blobFromString("hello world"), serviceId, asOpaqueType(key));

    const result = await read.execute(gas, registers, memory);
    assert.deepStrictEqual(result, PvmExecution.Panic);
  });
});
