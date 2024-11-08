import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { type Blake2bHash, hashBytes } from "@typeberry/hash";
import { Registers } from "@typeberry/pvm-interpreter";
import { type Gas, gasCounter } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { HostCallResult } from "./results";
import { SERVICE_ID_BYTES, writeServiceIdAsLeBytes } from "./utils";
import { type Accounts, Write } from "./write";

class TestAccounts implements Accounts {
  public readonly data: Map<ServiceId, HashDictionary<Blake2bHash, BytesBlob>> = new Map();
  public readonly snapshotData: Map<ServiceId, HashDictionary<Blake2bHash, BytesBlob>> = new Map();
  public isFull = false;

  isStorageFull(_serviceId: ServiceId): Promise<boolean> {
    return Promise.resolve(this.isFull);
  }

  write(serviceId: ServiceId, hash: Blake2bHash, data: BytesBlob | null): Promise<void> {
    let perService = this.data.get(serviceId);
    if (!perService) {
      perService = new HashDictionary();
      this.data.set(serviceId, perService);
    }

    if (data === null) {
      perService.delete(hash);
    } else {
      perService.set(hash, data);
    }

    return Promise.resolve();
  }

  readSnapshotLen(serviceId: ServiceId, hash: Blake2bHash): Promise<number | null> {
    const data = this.snapshotData.get(serviceId)?.get(hash);
    return Promise.resolve(data?.length ?? null);
  }

  setSnapshotData(serviceId: ServiceId, hash: Blake2bHash, data: BytesBlob) {
    let perService = this.snapshotData.get(serviceId);
    if (!perService) {
      perService = new HashDictionary();
      this.snapshotData.set(serviceId, perService);
    }
    perService.set(hash, data);
  }
}

const gas = gasCounter(0 as Gas);
const RESULT_REG = 7;
const KEY_START_REG = 7;
const KEY_LEN_REG = 8;
const DEST_START_REG = 9;
const DEST_LEN_REG = 10;

function prepareKey(serviceId: ServiceId, key: string) {
  const keyBytes = BytesBlob.fromString(key);
  const serviceIdAndKey = new Uint8Array(SERVICE_ID_BYTES + keyBytes.length);
  writeServiceIdAsLeBytes(serviceId, serviceIdAndKey);
  serviceIdAndKey.set(keyBytes.buffer, SERVICE_ID_BYTES);
  return { key: keyBytes, hash: hashBytes(serviceIdAndKey) };
}

function prepareRegsAndMemory(
  key: BytesBlob,
  dataInMemory: BytesBlob,
  { skipKey = false, skipValue = false }: { skipKey?: boolean; skipValue?: boolean } = {},
) {
  const keyAddress = 150_000;
  const memStart = 20_000;
  const registers = new Registers();
  registers.asUnsigned[KEY_START_REG] = keyAddress;
  registers.asUnsigned[KEY_LEN_REG] = key.length;
  registers.asUnsigned[DEST_START_REG] = memStart;
  registers.asUnsigned[DEST_LEN_REG] = dataInMemory.length;

  const builder = new MemoryBuilder();
  if (!skipKey) {
    builder.setReadable(tryAsMemoryIndex(keyAddress), tryAsMemoryIndex(keyAddress + key.length), key.buffer);
  }
  if (!skipValue && dataInMemory.length > 0) {
    builder.setReadable(
      tryAsMemoryIndex(memStart),
      tryAsMemoryIndex(memStart + dataInMemory.length),
      dataInMemory.buffer,
    );
  }
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsMemoryIndex(0));
  return {
    registers,
    memory,
  };
}

describe("HostCalls: Write", () => {
  it("should write data to account state", async () => {
    const accounts = new TestAccounts();
    const write = new Write(accounts);
    const serviceId = tryAsServiceId(10_000);
    write.currentServiceId = serviceId;
    const { key, hash } = prepareKey(write.currentServiceId, "imma key");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.fromString("hello world!"));
    accounts.setSnapshotData(serviceId, hash, BytesBlob.fromString("old data"));

    // when
    await write.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], "old data".length);
    assert.deepStrictEqual(accounts.data.get(serviceId)?.get(hash)?.asText(), "hello world!");
  });

  it("should remove data from account state", async () => {
    const accounts = new TestAccounts();
    const write = new Write(accounts);
    const serviceId = tryAsServiceId(10_000);
    write.currentServiceId = serviceId;
    const { key, hash } = prepareKey(write.currentServiceId, "xyz");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.fromNumbers([]));
    const h = new HashDictionary<Blake2bHash, BytesBlob>();
    h.set(hash, BytesBlob.fromString("hello world!"));
    accounts.data.set(serviceId, h);

    // when
    await write.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.NONE);
    assert.deepStrictEqual(accounts.data.get(serviceId)?.get(hash), undefined);
  });

  it("should fail if there is no memory for key", async () => {
    const accounts = new TestAccounts();
    const write = new Write(accounts);
    const serviceId = tryAsServiceId(10_000);
    write.currentServiceId = serviceId;
    const { key } = prepareKey(write.currentServiceId, "xyz");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.fromString("hello world!"), { skipKey: true });

    // when
    await write.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
    assert.deepStrictEqual(accounts.data.size, 0);
  });

  it("should fail if there is no memory for result", async () => {
    const accounts = new TestAccounts();
    const write = new Write(accounts);
    const serviceId = tryAsServiceId(10_000);
    write.currentServiceId = serviceId;
    const { key } = prepareKey(write.currentServiceId, "xyz");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.fromString("hello world!"), { skipValue: true });

    // when
    await write.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
    assert.deepStrictEqual(accounts.data.size, 0);
  });

  it("should fail if the key is not fully readable", async () => {
    const accounts = new TestAccounts();
    const write = new Write(accounts);
    const serviceId = tryAsServiceId(10_000);
    write.currentServiceId = serviceId;
    const { key } = prepareKey(write.currentServiceId, "xyz");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.fromString("hello world!"));
    registers.asUnsigned[KEY_LEN_REG] = 10;

    // when
    await write.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
    assert.deepStrictEqual(accounts.data.size, 0);
  });

  it("should fail if the value is not fully readable", async () => {
    const accounts = new TestAccounts();
    const write = new Write(accounts);
    const serviceId = tryAsServiceId(10_000);
    write.currentServiceId = serviceId;
    const { key } = prepareKey(write.currentServiceId, "xyz");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.fromString("hello world!"));
    registers.asUnsigned[DEST_LEN_REG] = 50;

    // when
    await write.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
    assert.deepStrictEqual(accounts.data.size, 0);
  });

  it("should handle storage full", async () => {
    const accounts = new TestAccounts();
    const write = new Write(accounts);
    const serviceId = tryAsServiceId(10_000);
    write.currentServiceId = serviceId;
    const { key, hash } = prepareKey(write.currentServiceId, "imma key");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.fromString("hello world!"));
    accounts.setSnapshotData(serviceId, hash, BytesBlob.fromString("old data"));
    accounts.isFull = true;

    // when
    await write.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.FULL);
    assert.deepStrictEqual(accounts.data.size, 0);
  });
});
