import { type Memory, MemoryBuilder } from "@typeberry/pvm-interpreter/memory";
import { createMemoryIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { Registers } from "@typeberry/pvm-interpreter/registers";
import { decodeStandardProgram } from "@typeberry/pvm-spi-decoder";

export class Program {
  static fromSpi(rawProgram: Uint8Array, args: Uint8Array) {
    const { code, memory: rawMemory, registers } = decodeStandardProgram(rawProgram, args);
    const regs = new Registers();
    regs.copyFrom(registers);
    const memoryBuilder = new MemoryBuilder();

    for (const { start, end, data } of rawMemory.readable) {
      const startIndex = createMemoryIndex(start);
      const endIndex = createMemoryIndex(end);
      memoryBuilder.setReadablePages(startIndex, endIndex, data ?? new Uint8Array());
    }

    for (const { start, end, data } of rawMemory.writeable) {
      const startIndex = createMemoryIndex(start);
      const endIndex = createMemoryIndex(end);
      memoryBuilder.setWriteablePages(startIndex, endIndex, data ?? new Uint8Array());
    }

    const heapStart = createMemoryIndex(rawMemory.sbrkIndex);
    const heapEnd = createMemoryIndex(rawMemory.heapEnd);
    const memory = memoryBuilder.finalize(heapStart, heapEnd);

    return new Program(code, regs, memory);
  }

  private constructor(
    public readonly code: Uint8Array,
    public readonly registers: Registers,
    public readonly memory: Memory,
  ) {}
}
