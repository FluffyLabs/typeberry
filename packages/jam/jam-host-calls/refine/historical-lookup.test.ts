import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import type { Blake2bHash } from "@typeberry/hash";
import { PvmExecution } from "@typeberry/pvm-host-calls";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { HostCallResult } from "../results";
import { HistoricalLookup } from "./historical-lookup";
import { TestRefineExt } from "./refine-externalities.test";

const gas = gasCounter(tryAsGas(0));
const SERVICE_ID_REG = 7;
const RESULT_REG = SERVICE_ID_REG;
const HASH_START_REG = 8;
const DEST_START_REG = 9;
const DEST_OFFSET_REG = 10;
const DEST_LEN_REG = 11;

function prepareRegsAndMemory(
  serviceId: ServiceId,
  hash: Blake2bHash,
  offset: number,
  destinationLength: number,
  { skipHash = false, writableMemory = true }: { skipHash?: boolean; writableMemory?: boolean } = {},
) {
  const hashAddress = 2 ** 16;
  const memStart = 2 ** 20;
  const registers = new Registers();
  registers.setU32(SERVICE_ID_REG, serviceId);
  registers.setU32(HASH_START_REG, hashAddress);
  registers.setU32(DEST_START_REG, memStart);
  registers.setU32(DEST_OFFSET_REG, offset);
  registers.setU32(DEST_LEN_REG, destinationLength);

  const builder = new MemoryBuilder();
  if (!skipHash) {
    builder.setReadablePages(tryAsMemoryIndex(hashAddress), tryAsMemoryIndex(hashAddress + PAGE_SIZE), hash.raw);
  }
  if (writableMemory) {
    builder.setWriteablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + PAGE_SIZE));
  }
  const memory = builder.finalize(tryAsSbrkIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory,
    readResult: () => {
      const result = new Uint8Array(destinationLength);
      assert.strictEqual(memory.loadInto(result, tryAsMemoryIndex(memStart)).isOk, true);
      return BytesBlob.blobFrom(result);
    },
  };
}

describe("HostCalls: Historical Lookup", () => {
  it("should lookup key from an account", async () => {
    const refine = new TestRefineExt();
    const lookup = new HistoricalLookup(refine);
    const serviceId = tryAsServiceId(10_000);
    const hash = Bytes.fill(32, 3);
    const data = "hello world";
    const { registers, memory, readResult } = prepareRegsAndMemory(serviceId, hash, 0, 64);
    refine.historicalLookupData.set(BytesBlob.blobFromString(data), serviceId, hash);

    // when
    const result = await lookup.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getLowerU32(RESULT_REG), data.length);
    assert.deepStrictEqual(
      readResult().toString(),
      "0x68656c6c6f20776f726c640000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    );
  });

  it("should lookup key longer than destination", async () => {
    const refine = new TestRefineExt();
    const lookup = new HistoricalLookup(refine);
    const serviceId = tryAsServiceId(10_000);
    const hash = Bytes.fill(32, 3);
    const data = "hello world";
    const { registers, memory, readResult } = prepareRegsAndMemory(serviceId, hash, 0, 3);
    refine.historicalLookupData.set(BytesBlob.blobFromString(data), serviceId, hash);

    // when
    const result = await lookup.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getLowerU32(RESULT_REG), data.length);
    assert.deepStrictEqual(readResult().toString(), "0x68656c");
  });

  it("should lookup key longer than destination + offset", async () => {
    const refine = new TestRefineExt();
    const lookup = new HistoricalLookup(refine);
    const serviceId = tryAsServiceId(10_000);
    const hash = Bytes.fill(32, 3);
    const data = "hello world";
    const { registers, memory, readResult } = prepareRegsAndMemory(serviceId, hash, 4, 3);
    refine.historicalLookupData.set(BytesBlob.blobFromString(data), serviceId, hash);

    // when
    const result = await lookup.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getLowerU32(RESULT_REG), data.length);
    assert.deepStrictEqual(readResult().toString(), "0x6f2077");
  });

  it("should handle missing value", async () => {
    const refine = new TestRefineExt();
    const lookup = new HistoricalLookup(refine);
    const serviceId = tryAsServiceId(10_000);
    const hash = Bytes.fill(32, 3);
    const { registers, memory, readResult } = prepareRegsAndMemory(serviceId, hash, 0, 32);
    refine.historicalLookupData.set(null, serviceId, hash);

    // when
    const result = await lookup.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG), HostCallResult.NONE);
    assert.deepStrictEqual(
      readResult().toString(),
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );
  });

  it("should panic if no memory for key", async () => {
    const refine = new TestRefineExt();
    const lookup = new HistoricalLookup(refine);
    const serviceId = tryAsServiceId(10_000);
    const hash = Bytes.fill(32, 3);
    const { registers, memory } = prepareRegsAndMemory(serviceId, hash, 0, 32, { skipHash: true });

    // when
    const result = await lookup.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(registers.getLowerU32(RESULT_REG), serviceId);
  });

  it("should panic if memory is not writable", async () => {
    const refine = new TestRefineExt();
    const lookup = new HistoricalLookup(refine);
    const serviceId = tryAsServiceId(10_000);
    const hash = Bytes.fill(32, 3);
    const data = "hello world";
    const { registers, memory } = prepareRegsAndMemory(serviceId, hash, 0, 32, { writableMemory: false });
    refine.historicalLookupData.set(BytesBlob.blobFromString(data), serviceId, hash);

    // when
    const result = await lookup.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(registers.getLowerU32(RESULT_REG), serviceId);
  });

  it("should handle if the destination length is greater than data length", async () => {
    const refine = new TestRefineExt();
    const lookup = new HistoricalLookup(refine);
    const serviceId = tryAsServiceId(10_000);
    const hash = Bytes.fill(32, 3);
    const data = "hello world";
    const { registers, memory, readResult } = prepareRegsAndMemory(serviceId, hash, 0, 32);
    refine.historicalLookupData.set(BytesBlob.blobFromString(data), serviceId, hash);
    registers.setU32(DEST_LEN_REG, PAGE_SIZE + 1);

    // when
    const result = await lookup.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getLowerU32(RESULT_REG), data.length);
    assert.deepStrictEqual(
      readResult().toString(),
      "0x68656c6c6f20776f726c64000000000000000000000000000000000000000000",
    );
  });

  it("should panic if the destination is beyond mem limit", async () => {
    const refine = new TestRefineExt();
    const lookup = new HistoricalLookup(refine);
    const serviceId = tryAsServiceId(10_000);
    const hash = Bytes.fill(32, 3);
    const data = "hello world";
    const { registers, memory } = prepareRegsAndMemory(serviceId, hash, 0, 32);
    refine.historicalLookupData.set(BytesBlob.blobFromString(data), serviceId, hash);
    registers.setU32(DEST_START_REG, 2 ** 32 - 1);
    registers.setU32(DEST_LEN_REG, 2 ** 10);

    // when
    const result = await lookup.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, PvmExecution.Panic);
    assert.deepStrictEqual(registers.getLowerU32(RESULT_REG), serviceId);
  });

  it("should handle 0-length destination", async () => {
    const refine = new TestRefineExt();
    const lookup = new HistoricalLookup(refine);
    const serviceId = tryAsServiceId(10_000);
    const hash = Bytes.fill(32, 3);
    const data = "hello world";
    const { registers, memory } = prepareRegsAndMemory(serviceId, hash, 0, 0);
    refine.historicalLookupData.set(BytesBlob.blobFromString(data), serviceId, hash);

    // when
    const result = await lookup.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getLowerU32(RESULT_REG), data.length);
  });
});
