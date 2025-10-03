import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas.js";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/index.js";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index.js";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts.js";
import { ServiceAccountInfo } from "@typeberry/state";
import { asOpaqueType } from "@typeberry/utils";
import { TestAccounts } from "./externalities/test-accounts.js";
import { HostCallResult } from "./results.js";
import { Write } from "./write.js";

const gas = gasCounter(tryAsGas(0));
const RESULT_REG = 7;
const KEY_START_REG = 7;
const KEY_LEN_REG = 8;
const DEST_START_REG = 9;
const DEST_LEN_REG = 10;

function prepareAccounts(
  serviceId: ServiceId,
  { balance, gratisStorage }: { balance?: bigint; gratisStorage?: bigint } = {},
) {
  const accounts = new TestAccounts(serviceId);
  accounts.details.set(
    serviceId,
    ServiceAccountInfo.create({
      codeHash: Bytes.fill(32, 5).asOpaque(),
      balance: tryAsU64(balance ?? 150_000),
      accumulateMinGas: tryAsServiceGas(0n),
      onTransferMinGas: tryAsServiceGas(0n),
      storageUtilisationBytes: tryAsU64(10_000),
      storageUtilisationCount: tryAsU32(1_000),
      gratisStorage: tryAsU64(gratisStorage ?? 0),
      created: tryAsTimeSlot(0),
      lastAccumulation: tryAsTimeSlot(0),
      parentService: tryAsServiceId(0),
    }),
  );
  return accounts;
}

function prepareRegsAndMemory(
  key: BytesBlob,
  dataInMemory: BytesBlob,
  { skipKey = false, skipValue = false }: { skipKey?: boolean; skipValue?: boolean } = {},
) {
  const keyAddress = 2 ** 18;
  const memStart = 2 ** 16;
  const registers = new HostCallRegisters(new Registers());
  registers.set(KEY_START_REG, tryAsU64(keyAddress));
  registers.set(KEY_LEN_REG, tryAsU64(key.length));
  registers.set(DEST_START_REG, tryAsU64(memStart));
  registers.set(DEST_LEN_REG, tryAsU64(dataInMemory.length));

  const builder = new MemoryBuilder();
  if (!skipKey) {
    builder.setReadablePages(tryAsMemoryIndex(keyAddress), tryAsMemoryIndex(keyAddress + PAGE_SIZE), key.raw);
  }
  if (!skipValue && dataInMemory.length > 0) {
    builder.setReadablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + PAGE_SIZE), dataInMemory.raw);
  }
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory: new HostCallMemory(memory),
  };
}

describe("HostCalls: Write", () => {
  it("should write data to account state", async () => {
    const serviceId = tryAsServiceId(10_000);
    const accounts = prepareAccounts(serviceId);
    const write = new Write(serviceId, accounts);
    const key = BytesBlob.blobFromString("imma key");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.blobFromString("hello world!"));
    accounts.storage.set(BytesBlob.blobFromString("old data"), serviceId, asOpaqueType(key));

    // when
    const result = await write.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), tryAsU64("old data".length));
    assert.deepStrictEqual(accounts.storage.get(serviceId, asOpaqueType(key))?.asText(), "hello world!");
    assert.deepStrictEqual(accounts.storage.data.size, 1);
  });

  it("should write data to account state when low balance but with gratisStorage", async () => {
    const serviceId = tryAsServiceId(10_000);
    const accounts = prepareAccounts(serviceId, { balance: 100n, gratisStorage: 150_000n });
    const write = new Write(serviceId, accounts);
    const key = BytesBlob.blobFromString("imma key");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.blobFromString("hello world!"));
    accounts.storage.set(BytesBlob.blobFromString("old data"), serviceId, asOpaqueType(key));

    // when
    const result = await write.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), tryAsU64("old data".length));
    assert.deepStrictEqual(accounts.storage.get(serviceId, asOpaqueType(key))?.asText(), "hello world!");
    assert.deepStrictEqual(accounts.storage.data.size, 1);
  });

  it("should remove data from account state", async () => {
    const serviceId = tryAsServiceId(10_000);
    const accounts = prepareAccounts(serviceId);
    const write = new Write(serviceId, accounts);
    const key = BytesBlob.blobFromString("xyz");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.blobFromNumbers([]));
    accounts.storage.set(BytesBlob.blobFromString("hello world!"), serviceId, asOpaqueType(key));
    accounts.storage.set(null, serviceId, asOpaqueType(key));

    // when
    const result = await write.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.NONE);
    assert.deepStrictEqual(accounts.storage.get(serviceId, asOpaqueType(key)), undefined);
  });

  it("should fail if there is no memory for key", async () => {
    const serviceId = tryAsServiceId(10_000);
    const accounts = prepareAccounts(serviceId);
    const write = new Write(serviceId, accounts);
    const key = BytesBlob.blobFromString("xyz");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.blobFromString("hello world!"), {
      skipKey: true,
    });

    // when
    const result = await write.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(accounts.storage.data.size, 0);
  });

  it("should fail if there is no memory for result", async () => {
    const serviceId = tryAsServiceId(10_000);
    const accounts = prepareAccounts(serviceId);
    const write = new Write(serviceId, accounts);
    const key = BytesBlob.blobFromString("xyz");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.blobFromString("hello world!"), {
      skipValue: true,
    });

    // when
    const result = await write.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(accounts.storage.data.size, 0);
  });

  it("should fail if the key is not fully readable", async () => {
    const serviceId = tryAsServiceId(10_000);
    const accounts = prepareAccounts(serviceId);
    const write = new Write(serviceId, accounts);
    const key = BytesBlob.blobFromString("xyz");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.blobFromString("hello world!"));
    registers.set(KEY_LEN_REG, tryAsU64(PAGE_SIZE + 1));

    // when
    const result = await write.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(accounts.storage.data.size, 0);
  });

  it("should fail if the value is not fully readable", async () => {
    const serviceId = tryAsServiceId(10_000);
    const accounts = prepareAccounts(serviceId);
    const write = new Write(serviceId, accounts);
    const key = BytesBlob.blobFromString("xyz");
    const { registers, memory } = prepareRegsAndMemory(key, BytesBlob.blobFromString("hello world!"));
    registers.set(DEST_LEN_REG, tryAsU64(PAGE_SIZE + 1));

    // when
    const result = await write.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(accounts.storage.data.size, 0);
  });

  it("should handle storage full when low balance in the account", async () => {
    const serviceId = tryAsServiceId(10_000);
    const accounts = prepareAccounts(serviceId, { balance: 100n });
    const write = new Write(serviceId, accounts);
    const key = BytesBlob.blobFromString("imma key");
    const { registers, memory } = prepareRegsAndMemory(
      key,
      BytesBlob.blobFromString("hello world! Is super long very very very."),
    );
    accounts.storage.set(BytesBlob.blobFromString("old data"), serviceId, asOpaqueType(key));

    // when
    const result = await write.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.FULL);
    assert.deepStrictEqual(accounts.storage.data.size, 1);
  });
});
