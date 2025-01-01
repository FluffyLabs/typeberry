import assert from "node:assert";
import { describe, it } from "node:test";
import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { type Blake2bHash, blake2b } from "@typeberry/hash";
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
  const memStart = 2 ** 20;
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
  const memory = builder.finalize(tryAsSbrkIndex(0), tryAsSbrkIndex(0));
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

describe("HostCalls: Historical Lookup", () => {
  it("should lookup key from an account", async () => {
    const refine = new TestRefineExt();
    const lookup = new HistoricalLookup(refine);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory, readResult } = prepareRegsAndMemory(serviceId, key, 64);
    refine.historicalLookupData.set(BytesBlob.blobFromString("hello world"), serviceId, blake2b.hashBytes(key));

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
    const refine = new TestRefineExt();
    const lookup = new HistoricalLookup(refine);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory, readResult } = prepareRegsAndMemory(serviceId, key, 3);
    refine.historicalLookupData.set(BytesBlob.blobFromString("hello world"), serviceId, blake2b.hashBytes(key));

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), "hello world".length);
    assert.deepStrictEqual(readResult().toString(), "0x68656c");
  });

  it("should handle missing value", async () => {
    const refine = new TestRefineExt();
    const lookup = new HistoricalLookup(refine);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory, readResult } = prepareRegsAndMemory(serviceId, key, 32);
    refine.historicalLookupData.set(null, serviceId, blake2b.hashBytes(key));

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
    const refine = new TestRefineExt();
    const lookup = new HistoricalLookup(refine);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory } = prepareRegsAndMemory(serviceId, key, 32, { skipKey: true });

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), HostCallResult.OOB);
  });

  it("should fail if there is no memory for result", async () => {
    const refine = new TestRefineExt();
    const lookup = new HistoricalLookup(refine);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory } = prepareRegsAndMemory(serviceId, key, 32, { skipValue: true });

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), HostCallResult.OOB);
  });

  it("should fail if the destination is not fully writeable", async () => {
    const refine = new TestRefineExt();
    const lookup = new HistoricalLookup(refine);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory } = prepareRegsAndMemory(serviceId, key, 32);
    registers.setU32(DEST_LEN_REG, PAGE_SIZE + 1);

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), HostCallResult.OOB);
  });

  it("should fail gracefuly if the destination is beyond mem limit", async () => {
    const refine = new TestRefineExt();
    const lookup = new HistoricalLookup(refine);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory } = prepareRegsAndMemory(serviceId, key, 32);
    registers.setU32(DEST_START_REG, 2 ** 32 - 1);
    registers.setU32(DEST_LEN_REG, 2 ** 10);

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), HostCallResult.OOB);
  });

  it("should handle 0-length destination", async () => {
    const refine = new TestRefineExt();
    const lookup = new HistoricalLookup(refine);
    const serviceId = tryAsServiceId(10_000);
    const key = Bytes.fill(32, 3);
    const { registers, memory } = prepareRegsAndMemory(serviceId, key, 0, { skipValue: true });
    refine.historicalLookupData.set(BytesBlob.blobFromString("hello world"), serviceId, blake2b.hashBytes(key));

    // when
    await lookup.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), "hello world".length);
  });
});
