import assert from "node:assert";
import { describe, it } from "node:test";
import { SEGMENT_BYTES, type SegmentIndex, tryAsSegmentIndex, tryAsServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { HostCallResult } from "../results";
import { Import } from "./import";
import { TestRefineExt } from "./refine-externalities.test";

const gas = gasCounter(tryAsGas(0));
const SEGMENT_INDEX_REG = 7;
const RESULT_REG = SEGMENT_INDEX_REG;
const DEST_START_REG = 8;
const DEST_LEN_REG = 9;

function prepareRegsAndMemory(
  segmentIndex: SegmentIndex,
  destinationLength: number,
  { skipDestination: skipValue = false }: { skipDestination?: boolean } = {},
) {
  const memStart = 3_145_728;
  const registers = new Registers();
  registers.set(SEGMENT_INDEX_REG, segmentIndex);
  registers.set(DEST_START_REG, memStart);
  registers.set(DEST_LEN_REG, destinationLength);

  const builder = new MemoryBuilder();
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

describe("HostCalls: Import", () => {
  it("should import a segment", async () => {
    const refine = new TestRefineExt();
    const imp = new Import(refine);
    imp.currentServiceId = tryAsServiceId(10_000);
    const segmentIdx = tryAsSegmentIndex(48879);
    const destinationLength = 128;
    const { registers, memory, readResult } = prepareRegsAndMemory(segmentIdx, destinationLength);
    refine.importSegmentData.set(segmentIdx, BytesBlob.blobFromString("hello world!"));

    // when
    await imp.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    assert.deepStrictEqual(
      readResult().toString(),
      "0x68656c6c6f20776f726c64210000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    );
  });

  it("should return NONE if segment is not present", async () => {
    const refine = new TestRefineExt();
    const imp = new Import(refine);
    imp.currentServiceId = tryAsServiceId(10_000);
    const segmentIdx = tryAsSegmentIndex(48879);
    const destinationLength = 32;
    const { registers, memory, readResult } = prepareRegsAndMemory(segmentIdx, destinationLength);
    refine.importSegmentData.set(segmentIdx, null);

    // when
    await imp.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.NONE);
    assert.deepStrictEqual(
      readResult().toString(),
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );
  });

  it("should return NONE if segment index is greater than U16", async () => {
    const refine = new TestRefineExt();
    const imp = new Import(refine);
    imp.currentServiceId = tryAsServiceId(10_000);
    const segmentIdx = tryAsSegmentIndex(48879);
    const destinationLength = 32;
    const { registers, memory, readResult } = prepareRegsAndMemory(segmentIdx, destinationLength);
    registers.set(SEGMENT_INDEX_REG, 2 ** 30);

    // when
    await imp.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.NONE);
    assert.deepStrictEqual(
      readResult().toString(),
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );
  });

  it("should return OOB if memory is not writeable", async () => {
    const refine = new TestRefineExt();
    const imp = new Import(refine);
    imp.currentServiceId = tryAsServiceId(10_000);
    const segmentIdx = tryAsSegmentIndex(48879);
    const destinationLength = 32;
    const { registers, memory } = prepareRegsAndMemory(segmentIdx, destinationLength, { skipDestination: true });

    // when
    await imp.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OOB);
  });

  it("should trim the result if only few bytes requested", async () => {
    const refine = new TestRefineExt();
    const imp = new Import(refine);
    imp.currentServiceId = tryAsServiceId(10_000);
    const segmentIdx = tryAsSegmentIndex(48879);
    const destinationLength = 2;
    const { registers, memory, readResult } = prepareRegsAndMemory(segmentIdx, destinationLength);
    refine.importSegmentData.set(segmentIdx, BytesBlob.blobFromString("hello world!"));

    // when
    await imp.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    assert.deepStrictEqual(readResult().toString(), "0x6865");
  });

  it("should trim the result if it's beyond maximal size", async () => {
    const refine = new TestRefineExt();
    const imp = new Import(refine);
    imp.currentServiceId = tryAsServiceId(10_000);
    const segmentIdx = tryAsSegmentIndex(48879);
    const expectedDestinationLength = SEGMENT_BYTES;
    const destinationLength = expectedDestinationLength + 10;
    const { registers, memory, readResult } = prepareRegsAndMemory(segmentIdx, expectedDestinationLength);
    registers.set(DEST_LEN_REG, destinationLength);
    refine.importSegmentData.set(segmentIdx, BytesBlob.blobFromString("hello world!"));

    // when
    await imp.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.OK);
    const res = readResult();
    assert.deepStrictEqual(res.toString().substr(0, 32), "0x68656c6c6f20776f726c6421000000");
    assert.deepStrictEqual(res.length, 4104);
    assert.ok(res.length < destinationLength, `${res.length} < ${destinationLength}`);
  });
});
