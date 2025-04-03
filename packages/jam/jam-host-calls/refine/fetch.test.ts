import assert from "node:assert";
import { describe, it } from "node:test";
import { SEGMENT_BYTES, type SegmentIndex, tryAsSegmentIndex, tryAsServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { PvmExecution } from "@typeberry/pvm-host-calls";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { HostCallResult } from "../results";
import { Fetch } from "./fetch";
import { TestRefineExt } from "./refine-externalities.test";

const gas = gasCounter(tryAsGas(0));
const DEST_START_REG = 7;
const RESULT_REG = DEST_START_REG;
const OFFSET_REG = 8;
const DEST_LEN_REG = 9;
const SEGMENT_TYPE_REG = 10;
const SEGMENT_INDEX_REG = 11;
const WORK_ITEM_INDEX_REG = 12;

function prepareRegsAndMemory(
  segmentType: number,
  segmentIndex: SegmentIndex,
  destinationLength: number,
  { skipDestination: skipValue = false, offset }: { skipDestination?: boolean; offset: number } = { offset: 0 },
) {
  const memStart = 2 ** 22;
  const registers = new Registers();
  registers.setU32(DEST_START_REG, memStart);
  registers.setU32(OFFSET_REG, offset);
  registers.setU32(DEST_LEN_REG, destinationLength);
  registers.setU32(SEGMENT_TYPE_REG, segmentType);
  registers.setU32(SEGMENT_INDEX_REG, segmentIndex);
  registers.setU32(WORK_ITEM_INDEX_REG, 0);

  const builder = new MemoryBuilder();
  if (!skipValue) {
    builder.setWriteablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + 2 * PAGE_SIZE));
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

describe("HostCalls: Fetch", () => {
  it("should fetch a segment", async () => {
    const refine = new TestRefineExt();
    const fetch = new Fetch(refine);
    fetch.currentServiceId = tryAsServiceId(10_000);
    const segmentType = 5;
    const segmentIdx = tryAsSegmentIndex(48879);
    const destinationLength = 128;
    const data = "hello world!";
    const { registers, memory, readResult } = prepareRegsAndMemory(segmentType, segmentIdx, destinationLength);
    refine.fetchSegmentData.set(segmentIdx, BytesBlob.blobFromString(data));

    // when
    const result = await fetch.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU32(RESULT_REG), data.length);
    assert.deepStrictEqual(
      readResult().toString(),
      "0x68656c6c6f20776f726c64210000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    );
  });

  it("should fetch a segment withour segmentIdx if in right type", async () => {
    const refine = new TestRefineExt();
    const fetch = new Fetch(refine);
    fetch.currentServiceId = tryAsServiceId(10_000);
    const segmentType = 0;
    const segmentIdx = tryAsSegmentIndex(48879);
    const destinationLength = 128;
    const data = "hello world!";
    const { registers, memory, readResult } = prepareRegsAndMemory(segmentType, segmentIdx, destinationLength);
    refine.fetchSegmentData.set(tryAsSegmentIndex(segmentType), BytesBlob.blobFromString(data));

    // when
    const result = await fetch.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU32(RESULT_REG), data.length);
    assert.deepStrictEqual(
      readResult().toString(),
      "0x68656c6c6f20776f726c64210000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    );
  });

  it("should fetch a segment with offset and length", async () => {
    const refine = new TestRefineExt();
    const fetch = new Fetch(refine);
    fetch.currentServiceId = tryAsServiceId(10_000);
    const segmentType = 5;
    const segmentIdx = tryAsSegmentIndex(48879);
    const offset = 6;
    const destinationLength = 3;
    const data = "hello world!";
    const { registers, memory, readResult } = prepareRegsAndMemory(segmentType, segmentIdx, destinationLength, {
      offset,
    });
    refine.fetchSegmentData.set(segmentIdx, BytesBlob.blobFromString(data));

    // when
    const result = await fetch.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU32(RESULT_REG), data.length);
    assert.deepStrictEqual(readResult().toString(), "0x776f72");
  });

  it("should return NONE if segment is not present", async () => {
    const refine = new TestRefineExt();
    const fetch = new Fetch(refine);
    fetch.currentServiceId = tryAsServiceId(10_000);
    const segmentType = 5;
    const segmentIdx = tryAsSegmentIndex(48879);
    const destinationLength = 32;
    const { registers, memory, readResult } = prepareRegsAndMemory(segmentType, segmentIdx, destinationLength);
    refine.fetchSegmentData.set(segmentIdx, null);

    // when
    const result = await fetch.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG), HostCallResult.NONE);
    assert.deepStrictEqual(
      readResult().toString(),
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );
  });

  it("should return NONE if segment index is greater than U16", async () => {
    const refine = new TestRefineExt();
    const fetch = new Fetch(refine);
    fetch.currentServiceId = tryAsServiceId(10_000);
    const segmentType = 5;
    const segmentIdx = tryAsSegmentIndex(48879);
    const destinationLength = 32;
    const { registers, memory, readResult } = prepareRegsAndMemory(segmentType, segmentIdx, destinationLength);
    registers.setU32(SEGMENT_INDEX_REG, 2 ** 30);

    // when
    const result = await fetch.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU64(RESULT_REG), HostCallResult.NONE);
    assert.deepStrictEqual(
      readResult().toString(),
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );
  });

  it("should panic if memory is not writeable", async () => {
    const refine = new TestRefineExt();
    const fetch = new Fetch(refine);
    fetch.currentServiceId = tryAsServiceId(10_000);
    const segmentType = 5;
    const segmentIdx = tryAsSegmentIndex(48879);
    const destinationLength = 32;
    const data = "hello world!";
    const { registers, memory } = prepareRegsAndMemory(segmentType, segmentIdx, destinationLength, {
      skipDestination: true,
      offset: 0,
    });
    refine.fetchSegmentData.set(segmentIdx, BytesBlob.blobFromString(data));

    // when
    const result = await fetch.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, PvmExecution.Panic);
  });

  it("should trim the result if only few bytes requested", async () => {
    const refine = new TestRefineExt();
    const fetch = new Fetch(refine);
    fetch.currentServiceId = tryAsServiceId(10_000);
    const segmentType = 5;
    const segmentIdx = tryAsSegmentIndex(48879);
    const destinationLength = 2;
    const data = "hello world!";
    const { registers, memory, readResult } = prepareRegsAndMemory(segmentType, segmentIdx, destinationLength);
    refine.fetchSegmentData.set(segmentIdx, BytesBlob.blobFromString(data));

    // when
    const result = await fetch.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU32(RESULT_REG), data.length);
    assert.deepStrictEqual(readResult().toString(), "0x6865");
  });

  it("should trim the result if it's beyond maximal size", async () => {
    const refine = new TestRefineExt();
    const fetch = new Fetch(refine);
    fetch.currentServiceId = tryAsServiceId(10_000);
    const segmentType = 5;
    const segmentIdx = tryAsSegmentIndex(48879);
    const expectedDestinationLength = SEGMENT_BYTES;
    const destinationLength = expectedDestinationLength + 10;
    const data = "hello world!";
    const { registers, memory, readResult } = prepareRegsAndMemory(segmentType, segmentIdx, expectedDestinationLength);
    registers.setU32(DEST_LEN_REG, destinationLength);
    refine.fetchSegmentData.set(segmentIdx, BytesBlob.blobFromString(data));

    // when
    const result = await fetch.execute(gas, registers, memory);

    // then
    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(registers.getU32(RESULT_REG), data.length);
    const res = readResult();
    assert.deepStrictEqual(res.toString().slice(0, 32), "0x68656c6c6f20776f726c6421000000");
    assert.deepStrictEqual(res.length, 4104);
    assert.ok(res.length < destinationLength, `${res.length} < ${destinationLength}`);
  });
});
