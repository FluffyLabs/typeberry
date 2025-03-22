import assert from "node:assert";
import { describe, it } from "node:test";
import { SEGMENT_BYTES, type Segment, tryAsSegmentIndex, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { Result } from "@typeberry/utils";
import { LegacyHostCallResult } from "../results";
import { Export } from "./export";
import { SegmentExportError } from "./refine-externalities";
import { TestRefineExt } from "./refine-externalities.test";

const gas = gasCounter(tryAsGas(0));
const SEGMENT_START_REG = 7;
const RESULT_REG = SEGMENT_START_REG;
const SEGMENT_LENGTH_REG = 8;

function prepareRegsAndMemory(
  segment: Segment,
  segmentLength: number = segment.length,
  { skipSegment = false }: { skipSegment?: boolean } = {},
) {
  const memStart = 2 ** 23;
  const registers = new Registers();
  registers.setU32(SEGMENT_START_REG, memStart);
  registers.setU32(SEGMENT_LENGTH_REG, segmentLength);

  const builder = new MemoryBuilder();
  if (!skipSegment) {
    builder.setReadablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + 2 * PAGE_SIZE), segment.raw);
  }
  const memory = builder.finalize(tryAsSbrkIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory,
  };
}

describe("HostCalls: Export", () => {
  it("should export a segment", async () => {
    const refine = new TestRefineExt();
    const exp = new Export(refine);
    exp.currentServiceId = tryAsServiceId(10_000);
    const segment = Bytes.fill(SEGMENT_BYTES, 15).asOpaque();
    const { registers, memory } = prepareRegsAndMemory(segment);
    refine.exportSegmentData.set(Result.ok(tryAsSegmentIndex(15)), segment);

    // when
    await exp.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), 15);
  });

  it("should zero-pad when exported value is small", async () => {
    const refine = new TestRefineExt();
    const exp = new Export(refine);
    exp.currentServiceId = tryAsServiceId(10_000);
    const segment = Bytes.fill(SEGMENT_BYTES, 15).asOpaque();
    const { registers, memory } = prepareRegsAndMemory(segment, 2);
    const expectedSegment = Bytes.zero(SEGMENT_BYTES);
    expectedSegment.raw[0] = 15;
    expectedSegment.raw[1] = 15;
    refine.exportSegmentData.set(Result.ok(tryAsSegmentIndex(5)), expectedSegment);
    // when
    await exp.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), 5);
  });

  it("should fail if memory is not readable", async () => {
    const refine = new TestRefineExt();
    const exp = new Export(refine);
    exp.currentServiceId = tryAsServiceId(10_000);
    const segment: Segment = Bytes.fill(SEGMENT_BYTES, 15).asOpaque();
    const { registers, memory } = prepareRegsAndMemory(segment, segment.length, { skipSegment: true });

    // when
    await exp.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.OOB);
  });

  it("should fail with FULL if export limit is reached", async () => {
    const refine = new TestRefineExt();
    const exp = new Export(refine);
    exp.currentServiceId = tryAsServiceId(10_000);
    const segment: Segment = Bytes.fill(SEGMENT_BYTES, 15).asOpaque();
    const { registers, memory } = prepareRegsAndMemory(segment);
    refine.exportSegmentData.set(Result.error(SegmentExportError), segment);

    // when
    await exp.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(registers.getU32(RESULT_REG), LegacyHostCallResult.FULL);
  });
});
