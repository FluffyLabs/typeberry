import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { MultiMap } from "@typeberry/collections";
import { type Blake2bHash, hashBytes } from "@typeberry/hash";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { HostCallResult } from "./results";
import { SERVICE_ID_BYTES, writeServiceIdAsLeBytes } from "./utils";
import { type Accounts, Write } from "./write";

class TestAccounts implements Accounts {
  public readonly data: MultiMap<[ServiceId, Blake2bHash], BytesBlob> = new MultiMap(2, [
    null,
    (hash) => hash.toString(),
  ]);
  public readonly snapshotData: MultiMap<[ServiceId, Blake2bHash], BytesBlob | null> = new MultiMap(2, [
    null,
    (hash) => hash.toString(),
  ]);
  public isFull = false;

  isStorageFull(_serviceId: ServiceId): Promise<boolean> {
    return Promise.resolve(this.isFull);
  }

  write(serviceId: ServiceId, hash: Blake2bHash, data: BytesBlob | null): Promise<void> {
    if (data === null) {
      this.data.delete(serviceId, hash);
    } else {
      this.data.set(data, serviceId, hash);
    }

    return Promise.resolve();
  }

  readSnapshotLen(serviceId: ServiceId, hash: Blake2bHash): Promise<number | null> {
    const data = this.snapshotData.get(serviceId, hash);
    if (data === undefined) {
      throw new Error(`Unexpected readSnapshotLen call with ${serviceId} ${hash}`);
    }
    return Promise.resolve(data?.length || null);
  }
}

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;
const KEY_START_REG = 7;
const KEY_LEN_REG = 8;
const DEST_START_REG = 9;
const DEST_LEN_REG = 10;

function prepareKey(serviceId: ServiceId, key: string) {
  const keyBytes = BytesBlob.blobFromString(key);
  const serviceIdAndKey = new Uint8Array(SERVICE_ID_BYTES + keyBytes.length);
  writeServiceIdAsLeBytes(serviceId, serviceIdAndKey);
  serviceIdAndKey.set(keyBytes.raw, SERVICE_ID_BYTES);
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
  registers.set(KEY_START_REG, keyAddress);
  registers.set(KEY_LEN_REG, key.length);
  registers.set(DEST_START_REG, memStart);
  registers.set(DEST_LEN_REG, dataInMemory.length);

  const builder = new MemoryBuilder();
  if (!skipKey) {
    builder.setReadable(tryAsMemoryIndex(keyAddress), tryAsMemoryIndex(keyAddress + key.length), key.raw);
  }
  if (!skipValue && dataInMemory.length > 0) {
    builder.setReadable(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + dataInMemory.length), dataInMemory.raw);
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
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.blobFromString("hello world!"));
    accounts.snapshotData.set(BytesBlob.blobFromString("old data"), serviceId, hash);

    // when
    await write.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), "old data".length);
    assert.deepStrictEqual(accounts.data.get(serviceId, hash)?.asText(), "hello world!");
  });

  it("should remove data from account state", async () => {
    const accounts = new TestAccounts();
    const write = new Write(accounts);
    const serviceId = tryAsServiceId(10_000);
    write.currentServiceId = serviceId;
    const { key, hash } = prepareKey(write.currentServiceId, "xyz");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.blobFromNumbers([]));
    accounts.data.set(BytesBlob.blobFromString("hello world!"), serviceId, hash);
    accounts.snapshotData.set(null, serviceId, hash);

    // when
    await write.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.NONE);
    assert.deepStrictEqual(accounts.data.get(serviceId, hash), undefined);
  });

  it("should fail if there is no memory for key", async () => {
    const accounts = new TestAccounts();
    const write = new Write(accounts);
    const serviceId = tryAsServiceId(10_000);
    write.currentServiceId = serviceId;
    const { key } = prepareKey(write.currentServiceId, "xyz");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.blobFromString("hello world!"), {
      skipKey: true,
    });

    // when
    await write.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OOB);
    assert.deepStrictEqual(accounts.data.data.size, 0);
  });

  it("should fail if there is no memory for result", async () => {
    const accounts = new TestAccounts();
    const write = new Write(accounts);
    const serviceId = tryAsServiceId(10_000);
    write.currentServiceId = serviceId;
    const { key } = prepareKey(write.currentServiceId, "xyz");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.blobFromString("hello world!"), {
      skipValue: true,
    });

    // when
    await write.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OOB);
    assert.deepStrictEqual(accounts.data.data.size, 0);
  });

  it("should fail if the key is not fully readable", async () => {
    const accounts = new TestAccounts();
    const write = new Write(accounts);
    const serviceId = tryAsServiceId(10_000);
    write.currentServiceId = serviceId;
    const { key } = prepareKey(write.currentServiceId, "xyz");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.blobFromString("hello world!"));
    registers.set(KEY_LEN_REG, 10);

    // when
    await write.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OOB);
    assert.deepStrictEqual(accounts.data.data.size, 0);
  });

  it("should fail if the value is not fully readable", async () => {
    const accounts = new TestAccounts();
    const write = new Write(accounts);
    const serviceId = tryAsServiceId(10_000);
    write.currentServiceId = serviceId;
    const { key } = prepareKey(write.currentServiceId, "xyz");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.blobFromString("hello world!"));
    registers.set(DEST_LEN_REG, 50);

    // when
    await write.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OOB);
    assert.deepStrictEqual(accounts.data.data.size, 0);
  });

  it("should handle storage full", async () => {
    const accounts = new TestAccounts();
    const write = new Write(accounts);
    const serviceId = tryAsServiceId(10_000);
    write.currentServiceId = serviceId;
    const { key, hash } = prepareKey(write.currentServiceId, "imma key");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.blobFromString("hello world!"));
    accounts.snapshotData.set(BytesBlob.blobFromString("old data"), serviceId, hash);
    accounts.isFull = true;

    // when
    await write.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.FULL);
    assert.deepStrictEqual(accounts.data.data.size, 0);
  });
});
