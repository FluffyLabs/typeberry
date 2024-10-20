import assert from "node:assert";
import { describe, it } from "node:test";
import { Memory, MemoryBuilder } from "../memory";
import { MEMORY_SIZE, PAGE_SIZE } from "../memory/memory-consts";
import { createMemoryIndex } from "../memory/memory-index";
import { Registers } from "../registers";
import { MemoryOps } from "./memory-ops";

describe("MemoryOps", () => {
  it("should allocate one memory page", () => {
    const regs = new Registers();
    const memory = new Memory();
    const memoryOps = new MemoryOps(regs, memory);
    const resultIndex = 1;
    const lengthIndex = 0;
    const length = PAGE_SIZE;
    regs.asUnsigned[lengthIndex] = length;
    const expectedMemory = new MemoryBuilder().finalize(createMemoryIndex(0), createMemoryIndex(MEMORY_SIZE));
    expectedMemory.sbrk(length);

    memoryOps.sbrk(lengthIndex, resultIndex);

    assert.deepEqual(regs.asUnsigned[resultIndex], 0);
    assert.deepStrictEqual(memory, expectedMemory);
  });

  it("should allocate two memory pages", () => {
    const regs = new Registers();
    const memory = new Memory();
    const memoryOps = new MemoryOps(regs, memory);
    const resultIndex = 1;
    const lengthIndex = 0;
    const length = 2 * PAGE_SIZE;
    regs.asUnsigned[lengthIndex] = length;
    const expectedMemory = new MemoryBuilder().finalize(createMemoryIndex(0), createMemoryIndex(MEMORY_SIZE));
    expectedMemory.sbrk(length);

    memoryOps.sbrk(lengthIndex, resultIndex);

    assert.deepEqual(regs.asUnsigned[resultIndex], 0);
    assert.deepStrictEqual(memory, expectedMemory);
  });

  it("should allocate two memory pages one by one", () => {
    const regs = new Registers();
    const memory = new Memory();
    const memoryOps = new MemoryOps(regs, memory);
    const resultIndex = 1;
    const lengthIndex = 0;
    const length = PAGE_SIZE;
    regs.asUnsigned[lengthIndex] = length;
    const expectedMemory = new MemoryBuilder().finalize(createMemoryIndex(0), createMemoryIndex(MEMORY_SIZE));
    expectedMemory.sbrk(length);
    expectedMemory.sbrk(length);

    memoryOps.sbrk(lengthIndex, resultIndex);
    memoryOps.sbrk(lengthIndex, resultIndex);

    assert.deepEqual(regs.asUnsigned[resultIndex], PAGE_SIZE);
    assert.deepStrictEqual(memory, expectedMemory);
  });
});
