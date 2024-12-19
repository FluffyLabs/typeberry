import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { MultiMap } from "@typeberry/collections";
import { type Blake2bHash, hashBytes } from "@typeberry/hash";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { type Accounts, Lookup } from "./lookup";
import { HostCallResult } from "./results";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";

class TestAccounts implements Accounts {
  public readonly data: MultiMap<[ServiceId, Blake2bHash], BytesBlob | null> = new MultiMap(2, [
    null,
    (hash) => hash.toString(),
  ]);

  lookup(serviceId: ServiceId, hash: Blake2bHash): Promise<BytesBlob | null> {
    const val = this.data.get(serviceId, hash);
    if (val === undefined) {
      throw new Error(`Unexpected lookup call with ${serviceId}, ${hash}`);
    }

    return Promise.resolve(val);
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
  const keyAddress = 2 ** 16;
  const memStart = 2 ** 22;
  const registers = new Registers();
  registers.setU32(SERVICE_ID_REG, serviceId);
  registers.setU32(KEY_START_REG, keyAddress);
  registers.setU32(DEST_START_REG, memStart);
  registers.setU32(DEST_LEN_REG, destinationLength);

  const builder = new MemoryBuilder();
  if (!skipKey) {
    builder.setReadablePages(tryAsMemoryIndex(keyAddress), tryAsMemoryIndex(keyAddress + PAGE_SIZE), key.raw);
  }
  if (!skipValue) {
    builder.setWriteablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + PAGE_SIZE));
  }
  const memory = builder.finalize(tryAsSbrkIndex(0), tryAsSbrkIndex(0))
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
    accounts.data.set(BytesBlob.blobFromString("hello world"), serviceId, hashBytes(key));

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), "hello world".length);
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
    accounts.data.set(BytesBlob.blobFromString("hello world"), serviceId, hashBytes(key));

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), "hello world".length);
    assert.deepStrictEqual(readResult().toString(), "0x68656c");
  });

  it("should handle missing value", async () => {
    const accounts = new TestAccounts();
    const lookup = new Lookup(accounts);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory, readResult } = prepareRegsAndMemory(serviceId, key, 32);
    accounts.data.set(null, serviceId, hashBytes(key));

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), HostCallResult.NONE);
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
    assert.deepStrictEqual(registers.getU32(RESULT_REG), HostCallResult.OOB);
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
    assert.deepStrictEqual(registers.getU32(RESULT_REG), HostCallResult.OOB);
  });

  it("should fail if the destination is not fully writeable", async () => {
    const accounts = new TestAccounts();
    const lookup = new Lookup(accounts);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory } = prepareRegsAndMemory(serviceId, key, 32);
    accounts.data.set(BytesBlob.blobFromString("hello world"), serviceId, hashBytes(key));
    registers.setU32(DEST_LEN_REG, PAGE_SIZE + 1);

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), HostCallResult.OOB);
  });

  it("should fail gracefuly if the destination is beyond mem limit", async () => {
    const accounts = new TestAccounts();
    const lookup = new Lookup(accounts);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory } = prepareRegsAndMemory(serviceId, key, 32);
    accounts.data.set(BytesBlob.blobFromString("hello world"), serviceId, hashBytes(key));
    registers.setU32(DEST_START_REG, 2 ** 32 - 1);
    registers.setU32(DEST_LEN_REG, 2 ** 10);

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), HostCallResult.OOB);
  });

  it("should handle 0-length destination", async () => {
    const accounts = new TestAccounts();
    const lookup = new Lookup(accounts);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory } = prepareRegsAndMemory(serviceId, key, 0, { skipValue: true });
    accounts.data.set(BytesBlob.blobFromString("hello world"), serviceId, hashBytes(key));

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), "hello world".length);
  });
});
