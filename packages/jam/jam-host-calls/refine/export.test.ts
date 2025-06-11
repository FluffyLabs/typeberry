import assert from "node:assert";
import { describe, it } from "node:test";
import { SEGMENT_BYTES, type Segment, tryAsSegmentIndex, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { tryAsU64 } from "@typeberry/numbers";
import { HostCallMemory, HostCallRegisters, PvmExecution } from "@typeberry/pvm-host-calls";
import { Registers } from "@typeberry/pvm-interpreter";
import { gasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas.js";
import { MemoryBuilder, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/index.js";
import { tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index.js";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts.js";
import { Result } from "@typeberry/utils";
import { SegmentExportError } from "../externalities/refine-externalities.js";
import { TestRefineExt } from "../externalities/refine-externalities.test.js";
import { HostCallResult } from "../results.js";
import { Export } from "./export.js";

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
  const registers = new HostCallRegisters(new Registers());
  registers.set(SEGMENT_START_REG, tryAsU64(memStart));
  registers.set(SEGMENT_LENGTH_REG, tryAsU64(segmentLength));

  const builder = new MemoryBuilder();
  if (!skipSegment) {
    builder.setReadablePages(tryAsMemoryIndex(memStart), tryAsMemoryIndex(memStart + 2 * PAGE_SIZE), segment.raw);
  }
  const memory = builder.finalize(tryAsMemoryIndex(0), tryAsSbrkIndex(0));
  return {
    registers,
    memory: new HostCallMemory(memory),
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
    const result = await exp.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), 15n);
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
    const result = await exp.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), 5n);
  });

  it("should panic if memory is not readable", async () => {
    const refine = new TestRefineExt();
    const exp = new Export(refine);
    exp.currentServiceId = tryAsServiceId(10_000);
    const segment: Segment = Bytes.fill(SEGMENT_BYTES, 15).asOpaque();
    const { registers, memory } = prepareRegsAndMemory(segment, segment.length, { skipSegment: true });

    // when
    const result = await exp.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, PvmExecution.Panic);
  });

  it("should fail with FULL if export limit is reached", async () => {
    const refine = new TestRefineExt();
    const exp = new Export(refine);
    exp.currentServiceId = tryAsServiceId(10_000);
    const segment: Segment = Bytes.fill(SEGMENT_BYTES, 15).asOpaque();
    const { registers, memory } = prepareRegsAndMemory(segment);
    refine.exportSegmentData.set(Result.error(SegmentExportError), segment);

    // when
    const result = await exp.execute(gas, registers, memory);

    // then
    assert.deepStrictEqual(result, undefined);
    assert.deepStrictEqual(registers.get(RESULT_REG), HostCallResult.FULL);
  });
});
