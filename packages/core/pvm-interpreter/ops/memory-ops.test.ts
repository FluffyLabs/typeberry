import assert from "node:assert";
import { describe, it } from "node:test";
import { InstructionResult } from "../instruction-result";
import { Memory, MemoryBuilder } from "../memory";
import { MAX_MEMORY_INDEX, PAGE_SIZE } from "../memory/memory-consts";
import { tryAsMemoryIndex, tryAsSbrkIndex } from "../memory/memory-index";
import { Registers } from "../registers";
import { MemoryOps } from "./memory-ops";

describe("MemoryOps", () => {
  function prepareData(pagesToAllocate: number, lengthRegisterValue = PAGE_SIZE) {
    const regs = Registers.empty();
    const memory = new Memory();
    const instructionResult = new InstructionResult();
    const memoryOps = new MemoryOps(regs, memory, instructionResult);
    const resultIndex = 1;
    const lengthIndex = 0;
    regs.setU32(lengthIndex, lengthRegisterValue);
    const expectedMemory = new MemoryBuilder()
      .setWriteablePages(tryAsMemoryIndex(0), tryAsMemoryIndex(pagesToAllocate * PAGE_SIZE))
      .finalize(tryAsSbrkIndex(pagesToAllocate * PAGE_SIZE), tryAsSbrkIndex(MAX_MEMORY_INDEX));
    return { regs, memory, expectedMemory, instructionResult, memoryOps, resultIndex, lengthIndex };
  }

  it("should allocate one memory page", () => {
    const pagesToAllocate = 1;
    const { memoryOps, regs, resultIndex, lengthIndex, memory, expectedMemory } = prepareData(pagesToAllocate);

    memoryOps.sbrk(lengthIndex, resultIndex);

    assert.deepEqual(regs.getU32(resultIndex), 0);
    assert.deepStrictEqual(memory, expectedMemory);
  });

  it("should allocate two memory pages", () => {
    const pagesToAllocate = 2;
    const { memoryOps, regs, resultIndex, lengthIndex, memory, expectedMemory } = prepareData(
      pagesToAllocate,
      2 * PAGE_SIZE,
    );

    memoryOps.sbrk(lengthIndex, resultIndex);

    assert.deepEqual(regs.getU32(resultIndex), 0);
    assert.deepStrictEqual(memory, expectedMemory);
  });

  it("should allocate two memory pages one by one", () => {
    const pagesToAllocate = 2;
    const { memoryOps, regs, resultIndex, lengthIndex, memory, expectedMemory } = prepareData(pagesToAllocate);

    memoryOps.sbrk(lengthIndex, resultIndex);
    assert.deepEqual(regs.getU32(resultIndex), 0);

    memoryOps.sbrk(lengthIndex, resultIndex);

    assert.deepEqual(regs.getU32(resultIndex), PAGE_SIZE);
    assert.deepStrictEqual(memory, expectedMemory);
  });
});
