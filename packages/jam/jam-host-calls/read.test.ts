import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { MultiMap } from "@typeberry/collections";
import { type Blake2bHash, blake2b } from "@typeberry/hash";
import { tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution } from "@typeberry/pvm-host-calls/host-call-handler";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { OK, Result } from "@typeberry/utils";
import { type Accounts, Read } from "./read";
import { HostCallResult } from "./results";
import { PLACEHOLDER_SERVICE_ID, SERVICE_ID_BYTES, writeServiceIdAsLeBytes } from "./utils";

class TestAccounts implements Accounts {
  public readonly data: MultiMap<[ServiceId, Blake2bHash], BytesBlob | null> = new MultiMap(2, [
    null,
    (hash) => hash.toString(),
  ]);

  read(serviceId: ServiceId | null, hash: Blake2bHash): Promise<BytesBlob | null> {
    if (serviceId === null) {
      return Promise.resolve(null);
    }

    const d = this.data.get(serviceId, hash);
    if (d === undefined) {
      throw new Error(`Unexpected call to read with ${serviceId}, ${hash}`);
    }
    return Promise.resolve(d);
  }
}

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
    registers.setU64(SERVICE_ID_REG, PLACEHOLDER_SERVICE_ID);
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
    it("for current account", async () => {
      const accounts = new TestAccounts();
      const read = new Read(accounts);
      const serviceId = tryAsServiceId(10_000);
      read.currentServiceId = serviceId;
      const { key, hash } = prepareKey(read.currentServiceId, "key");
      const value = "hello world";
      const { registers, memory, readResult } = prepareRegsAndMemory(key, value.length);
      accounts.data.set(BytesBlob.blobFromString(value), serviceId, hash);

      const result = await read.execute(gas, registers, memory);

      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), tryAsU64(value.length));
      assert.deepStrictEqual(readResult().asText(), value);
    });

    it("for different service Id", async () => {
      const accounts = new TestAccounts();
      const read = new Read(accounts);
      read.currentServiceId = tryAsServiceId(10_000);
      const serviceId = tryAsServiceId(11_000);
      const { key, hash } = prepareKey(read.currentServiceId, "key");
      const value = "hello world";
      const { registers, memory, readResult } = prepareRegsAndMemory(key, value.length, {
        serviceId,
      });
      accounts.data.set(BytesBlob.blobFromString(value), serviceId, hash);

      const result = await read.execute(gas, registers, memory);

      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), tryAsU64(value.length));
      assert.deepStrictEqual(readResult().asText(), value);
    });

    it("with offset", async () => {
      const accounts = new TestAccounts();
      const read = new Read(accounts);
      const serviceId = tryAsServiceId(10_000);
      read.currentServiceId = serviceId;
      const { key, hash } = prepareKey(read.currentServiceId, "key");
      const value = "hello world";
      const { registers, memory, readResult } = prepareRegsAndMemory(key, value.length, {
        valueOffset: 6,
      });
      accounts.data.set(BytesBlob.blobFromString(value), serviceId, hash);

      const result = await read.execute(gas, registers, memory);

      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), tryAsU64(value.length));
      assert.deepStrictEqual(readResult().toString(), "0x776f726c64");
    });

    it("with offset and length", async () => {
      const accounts = new TestAccounts();
      const read = new Read(accounts);
      const serviceId = tryAsServiceId(10_000);
      read.currentServiceId = serviceId;
      const { key, hash } = prepareKey(read.currentServiceId, "key");
      const value = "hello world";
      const { registers, memory, readResult } = prepareRegsAndMemory(key, value.length, {
        valueOffset: 6,
        valueLengthToWrite: 1,
      });
      accounts.data.set(BytesBlob.blobFromString(value), serviceId, hash);

      const result = await read.execute(gas, registers, memory);

      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), tryAsU64(value.length));
      assert.deepStrictEqual(readResult().toString(), "0x7700000000");
    });

    it("with 0-length destination target", async () => {
      const accounts = new TestAccounts();
      const read = new Read(accounts);
      const serviceId = tryAsServiceId(10_000);
      read.currentServiceId = serviceId;
      const { key, hash } = prepareKey(read.currentServiceId, "xyz");
      const value = "hello world";
      const { registers, memory, readResult } = prepareRegsAndMemory(key, value.length, { valueLengthToWrite: 0 });
      accounts.data.set(BytesBlob.blobFromString(value), serviceId, hash);
      const result = await read.execute(gas, registers, memory);

      assert.deepStrictEqual(result, undefined);
      assert.deepStrictEqual(registers.get(RESULT_REG), tryAsU64(value.length));
      assert.deepStrictEqual(readResult().toString(), "0x0000000000000000000000");
    });
  });

  it("should handle missing account", async () => {
    const accounts = new TestAccounts();
    const read = new Read(accounts);
    read.currentServiceId = tryAsServiceId(10_000);
    const value = "xyz";
    const { key } = prepareKey(read.currentServiceId, value);
    const { registers, memory } = prepareRegsAndMemory(key, value.length);

    // serviceId out of range
    registers.set(SERVICE_ID_REG, tryAsU64(2n ** 32n));

    const result = await read.execute(gas, registers, memory);

    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(SERVICE_ID_REG), HostCallResult.NONE);
  });

  it("should handle missing value", async () => {
    const accounts = new TestAccounts();
    const read = new Read(accounts);
    const serviceId = tryAsServiceId(10_000);
    read.currentServiceId = serviceId;
    const value = "xyz";
    const { key, hash } = prepareKey(read.currentServiceId, value);
    const { registers, memory, readResult } = prepareRegsAndMemory(key, value.length);
    accounts.data.set(null, serviceId, hash);

    const result = await read.execute(gas, registers, memory);

    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.NONE);
    assert.deepStrictEqual(readResult().toString(), "0x000000");
  });

  it("should fail if there is no memory for key", async () => {
    const accounts = new TestAccounts();
    const read = new Read(accounts);
    const serviceId = tryAsServiceId(10_000);
    read.currentServiceId = serviceId;
    const value = "xyz";
    const { key, hash } = prepareKey(read.currentServiceId, value);
    const { registers, memory } = prepareRegsAndMemory(key, value.length, { skipKey: true });
    accounts.data.set(BytesBlob.blobFromString("hello world"), serviceId, hash);

    const result = await read.execute(gas, registers, memory);
    assert.deepStrictEqual(result, PvmExecution.Panic);
  });

  it("should fail if there is no memory for result", async () => {
    const accounts = new TestAccounts();
    const read = new Read(accounts);
    const serviceId = tryAsServiceId(10_000);
    read.currentServiceId = serviceId;
    const value = "xyz";
    const { key, hash } = prepareKey(read.currentServiceId, value);
    const { registers, memory } = prepareRegsAndMemory(key, value.length, { skipValue: true });
    accounts.data.set(BytesBlob.blobFromString("hello world"), serviceId, hash);

    const result = await read.execute(gas, registers, memory);
    assert.deepStrictEqual(result, PvmExecution.Panic);
  });
});
