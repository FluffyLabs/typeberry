import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { MultiMap } from "@typeberry/collections";
import { type Blake2bHash, blake2b } from "@typeberry/hash";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { type Accounts, Read } from "./read";
import { HostCallResult } from "./results";
import { SERVICE_ID_BYTES, writeServiceIdAsLeBytes } from "./utils";

class TestAccounts implements Accounts {
  public readonly data: MultiMap<[ServiceId, Blake2bHash], BytesBlob | null> = new MultiMap(2, [
    null,
    (hash) => hash.toString(),
  ]);

  read(serviceId: ServiceId, hash: Blake2bHash): Promise<BytesBlob | null> {
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
const DEST_LEN_REG = 11;

function prepareKey(serviceId: ServiceId, key: string) {
  const keyBytes = BytesBlob.blobFromString(key);
  const serviceIdAndKey = new Uint8Array(SERVICE_ID_BYTES + keyBytes.length);
  writeServiceIdAsLeBytes(serviceId, serviceIdAndKey);
  serviceIdAndKey.set(keyBytes.raw, SERVICE_ID_BYTES);
  return { key: keyBytes, hash: blake2b.hashBytes(serviceIdAndKey) };
}

function prepareRegsAndMemory(
  readServiceId: ServiceId,
  key: BytesBlob,
  destinationLength: number,
  { skipKey = false, skipValue = false }: { skipKey?: boolean; skipValue?: boolean } = {},
) {
  const keyAddress = 150_000;
  const memStart = 20_000;
  const registers = new Registers();
  registers.asUnsigned[SERVICE_ID_REG] = readServiceId;
  registers.asUnsigned[KEY_START_REG] = keyAddress;
  registers.asUnsigned[KEY_LEN_REG] = key.length;
  registers.asUnsigned[DEST_START_REG] = memStart;
  registers.asUnsigned[DEST_LEN_REG] = destinationLength;

  const builder = new MemoryBuilder();
  if (!skipKey) {
    builder.setReadable(tryAsMemoryIndex(keyAddress), tryAsMemoryIndex(keyAddress + key.length), key.raw);
  }
  if (!skipValue) {
    builder.setWriteable(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + destinationLength));
  }
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsMemoryIndex(0));
  return {
    registers,
    memory,
    readResult: () => {
      const result = new Uint8Array(destinationLength);
      assert.strictEqual(memory.loadInto(result, tryAsMemoryIndex(memStart)), null);
      return BytesBlob.blobFrom(result);
    },
  };
}

describe("HostCalls: Read", () => {
  it("should read key from an account state", async () => {
    const accounts = new TestAccounts();
    const read = new Read(accounts);
    const serviceId = tryAsServiceId(10_000);
    read.currentServiceId = serviceId;
    const { key, hash } = prepareKey(read.currentServiceId, "hello world");
    const { registers, memory, readResult } = prepareRegsAndMemory(tryAsServiceId(2 ** 32 - 1), key, 64);
    accounts.data.set(BytesBlob.blobFromString("hello world"), serviceId, hash);

    // when
    await read.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], "hello world".length);
    assert.deepStrictEqual(
      readResult().toString(),
      "0x68656c6c6f20776f726c640000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    );
  });

  it("should read key from different service Id", async () => {
    const accounts = new TestAccounts();
    const read = new Read(accounts);
    read.currentServiceId = tryAsServiceId(10_000);
    const serviceId = tryAsServiceId(11_000);
    const { key, hash } = prepareKey(read.currentServiceId, "hello world");
    const { registers, memory, readResult } = prepareRegsAndMemory(serviceId, key, 64);
    accounts.data.set(BytesBlob.blobFromString("hello world"), serviceId, hash);

    // when
    await read.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], "hello world".length);
    assert.deepStrictEqual(
      readResult().toString(),
      "0x68656c6c6f20776f726c640000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    );
  });

  it("should read key longer than destination", async () => {
    const accounts = new TestAccounts();
    const read = new Read(accounts);
    const serviceId = tryAsServiceId(10_000);
    read.currentServiceId = serviceId;
    const { key, hash } = prepareKey(read.currentServiceId, "xyz");
    const { registers, memory, readResult } = prepareRegsAndMemory(serviceId, key, 3);
    accounts.data.set(BytesBlob.blobFromString("hello world"), serviceId, hash);

    // when
    await read.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], "hello world".length);
    assert.deepStrictEqual(readResult().toString(), "0x68656c");
  });

  it("should handle missing value", async () => {
    const accounts = new TestAccounts();
    const read = new Read(accounts);
    const serviceId = tryAsServiceId(10_000);
    read.currentServiceId = serviceId;
    const { key, hash } = prepareKey(read.currentServiceId, "xyz");
    const { registers, memory, readResult } = prepareRegsAndMemory(serviceId, key, 32);
    accounts.data.set(null, serviceId, hash);

    // when
    await read.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.NONE);
    assert.deepStrictEqual(
      readResult().toString(),
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );
  });

  it("should fail if there is no memory for key", async () => {
    const accounts = new TestAccounts();
    const read = new Read(accounts);
    const serviceId = tryAsServiceId(10_000);
    read.currentServiceId = serviceId;
    const { key, hash } = prepareKey(read.currentServiceId, "xyz");
    const { registers, memory } = prepareRegsAndMemory(serviceId, key, 32, { skipKey: true });
    accounts.data.set(BytesBlob.blobFromString("hello world"), serviceId, hash);

    // when
    await read.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
  });

  it("should fail if there is no memory for result", async () => {
    const accounts = new TestAccounts();
    const read = new Read(accounts);
    const serviceId = tryAsServiceId(10_000);
    read.currentServiceId = serviceId;
    const { key, hash } = prepareKey(read.currentServiceId, "xyz");
    const { registers, memory } = prepareRegsAndMemory(serviceId, key, 32, { skipValue: true });
    accounts.data.set(BytesBlob.blobFromString("hello world"), serviceId, hash);

    // when
    await read.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
  });

  it("should fail if the destination is not fully writeable", async () => {
    const accounts = new TestAccounts();
    const read = new Read(accounts);
    const serviceId = tryAsServiceId(10_000);
    read.currentServiceId = serviceId;
    const { key, hash } = prepareKey(read.currentServiceId, "xyz");
    const { registers, memory } = prepareRegsAndMemory(serviceId, key, 32);
    accounts.data.set(BytesBlob.blobFromString("hello world"), serviceId, hash);
    registers.asUnsigned[DEST_LEN_REG] = 34;

    // when
    await read.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
  });

  it("should fail gracefuly if the destination is beyond mem limit", async () => {
    const accounts = new TestAccounts();
    const read = new Read(accounts);
    const serviceId = tryAsServiceId(10_000);
    read.currentServiceId = serviceId;
    const { key, hash } = prepareKey(read.currentServiceId, "xyz");
    const { registers, memory } = prepareRegsAndMemory(serviceId, key, 32);
    accounts.data.set(BytesBlob.blobFromString("hello world"), serviceId, hash);
    registers.asUnsigned[DEST_START_REG] = 2 ** 32 - 1;
    registers.asUnsigned[DEST_LEN_REG] = 2 ** 10;

    // when
    await read.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
  });

  it("should handle 0-length destination", async () => {
    const accounts = new TestAccounts();
    const read = new Read(accounts);
    const serviceId = tryAsServiceId(10_000);
    read.currentServiceId = serviceId;
    const { key, hash } = prepareKey(read.currentServiceId, "xyz");
    const { registers, memory } = prepareRegsAndMemory(serviceId, key, 0, { skipValue: true });
    accounts.data.set(BytesBlob.blobFromString("hello world"), serviceId, hash);

    // when
    await read.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], "hello world".length);
  });
});
