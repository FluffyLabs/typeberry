import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { type Blake2bHash, hashBytes } from "@typeberry/hash";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { type Accounts, Lookup } from "./lookup";
import { HostCallResult } from "./results";

class TestAccounts implements Accounts {
  public readonly data: Map<ServiceId, HashDictionary<Blake2bHash, BytesBlob>> = new Map();

  lookup(serviceId: ServiceId, hash: Blake2bHash): Promise<BytesBlob | null> {
    return Promise.resolve(this.data.get(serviceId)?.get(hash) ?? null);
  }

  add(serviceId: ServiceId, key: Blake2bHash, value: BytesBlob) {
    let forAccount = this.data.get(serviceId);
    if (!forAccount) {
      forAccount = new HashDictionary();
      this.data.set(serviceId, forAccount);
    }
    forAccount.set(hashBytes(BytesBlob.blobFrom(key.raw)), value);
  }
}

const gas = gasCounter(tryAsGas(0));
const SERVICE_ID_REG = 7;
const RESULT_REG = SERVICE_ID_REG;
const KEY_START_REG = 8;
const DEST_START_REG = 9;
const DEST_LEN_REG = 10;

function prepareRegsAndMemory(
  serviceId: ServiceId,
  key: Blake2bHash,
  destinationLength: number,
  { skipKey = false, skipValue = false }: { skipKey?: boolean; skipValue?: boolean } = {},
) {
  const keyAddress = 15_000;
  const memStart = 3_400_000;
  const registers = new Registers();
  registers.asUnsigned[SERVICE_ID_REG] = serviceId;
  registers.asUnsigned[KEY_START_REG] = keyAddress;
  registers.asUnsigned[DEST_START_REG] = memStart;
  registers.asUnsigned[DEST_LEN_REG] = destinationLength;

  const builder = new MemoryBuilder();
  if (!skipKey) {
    builder.setReadable(tryAsMemoryIndex(keyAddress), tryAsMemoryIndex(keyAddress + 32), key.raw);
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

describe("HostCalls: Lookup", () => {
  it("should lookup key from an account", async () => {
    const accounts = new TestAccounts();
    const lookup = new Lookup(accounts);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory, readResult } = prepareRegsAndMemory(serviceId, key, 64);
    accounts.add(serviceId, key, BytesBlob.blobFromString("hello world"));

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], "hello world".length);
    assert.deepStrictEqual(
      readResult().toString(),
      "0x68656c6c6f20776f726c640000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    );
  });

  it("should lookup key longer than destination", async () => {
    const accounts = new TestAccounts();
    const lookup = new Lookup(accounts);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory, readResult } = prepareRegsAndMemory(serviceId, key, 3);
    accounts.add(serviceId, key, BytesBlob.blobFromString("hello world"));

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], "hello world".length);
    assert.deepStrictEqual(readResult().toString(), "0x68656c");
  });

  it("should handle missing value", async () => {
    const accounts = new TestAccounts();
    const lookup = new Lookup(accounts);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory, readResult } = prepareRegsAndMemory(serviceId, key, 32);

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.NONE);
    assert.deepStrictEqual(
      readResult().toString(),
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );
  });

  it("should fail if there is no memory for key", async () => {
    const accounts = new TestAccounts();
    const lookup = new Lookup(accounts);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory } = prepareRegsAndMemory(serviceId, key, 32, { skipKey: true });

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
  });

  it("should fail if there is no memory for result", async () => {
    const accounts = new TestAccounts();
    const lookup = new Lookup(accounts);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory } = prepareRegsAndMemory(serviceId, key, 32, { skipValue: true });

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
  });

  it("should fail if the destination is not fully writeable", async () => {
    const accounts = new TestAccounts();
    const lookup = new Lookup(accounts);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory } = prepareRegsAndMemory(serviceId, key, 32);
    accounts.add(serviceId, key, BytesBlob.blobFromString("hello world"));
    registers.asUnsigned[DEST_LEN_REG] = 34;

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
  });

  it("should fail gracefuly if the destination is beyond mem limit", async () => {
    const accounts = new TestAccounts();
    const lookup = new Lookup(accounts);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory } = prepareRegsAndMemory(serviceId, key, 32);
    accounts.add(serviceId, key, BytesBlob.blobFromString("hello world"));
    registers.asUnsigned[DEST_START_REG] = 2 ** 32 - 1;
    registers.asUnsigned[DEST_LEN_REG] = 2 ** 10;

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], HostCallResult.OOB);
  });

  it("should handle 0-length destination", async () => {
    const accounts = new TestAccounts();
    const lookup = new Lookup(accounts);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory } = prepareRegsAndMemory(serviceId, key, 0, { skipValue: true });
    accounts.add(serviceId, key, BytesBlob.blobFromString("hello world"));

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.asUnsigned[RESULT_REG], "hello world".length);
  });
});
