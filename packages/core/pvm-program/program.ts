import { Decoder } from "@typeberry/codec";
import { Memory, MemoryBuilder } from "@typeberry/pvm-interpreter/memory";
import { tryAsMemoryIndex, tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { Registers } from "@typeberry/pvm-interpreter/registers";
import { decodeStandardProgram } from "@typeberry/pvm-spi-decoder";

export class Program {
  static fromSpi(blob: Uint8Array, args: Uint8Array, hasMetadata: boolean) {
    const { code: spiCode } = hasMetadata ? extractCodeAndMetadata(blob) : { code: blob };
    const { code, memory: rawMemory, registers } = decodeStandardProgram(spiCode, args);
    const regs = new Registers();
    regs.copyFrom(registers);
    const memoryBuilder = new MemoryBuilder();

    for (const { start, end, data } of rawMemory.readable) {
      const startIndex = tryAsMemoryIndex(start);
      const endIndex = tryAsMemoryIndex(end);
      memoryBuilder.setReadablePages(startIndex, endIndex, data ?? new Uint8Array());
    }

    for (const { start, end, data } of rawMemory.writeable) {
      const startIndex = tryAsMemoryIndex(start);
      const endIndex = tryAsMemoryIndex(end);
      memoryBuilder.setWriteablePages(startIndex, endIndex, data ?? new Uint8Array());
    }

    const heapStart = tryAsMemoryIndex(rawMemory.sbrkIndex);
    const heapEnd = tryAsSbrkIndex(rawMemory.heapEnd);
    const memory = memoryBuilder.finalize(heapStart, heapEnd);

    return new Program(code, regs, memory);
  }

  static fromGeneric(blob: Uint8Array, hasMetadata: boolean) {
    const { code } = hasMetadata ? extractCodeAndMetadata(blob) : { code: blob };
    const regs = new Registers();
    const memory = new Memory();
    return new Program(code, regs, memory);
  }

  private constructor(
    public readonly code: Uint8Array,
    public readonly registers: Registers,
    public readonly memory: Memory,
  ) {}
}

/**
 * A function that splits preimage into metadata and code.
 *
 * https://graypaper.fluffylabs.dev/#/cc517d7/109a01109a01?v=0.6.5
 */
export function extractCodeAndMetadata(blobWithMetadata: Uint8Array) {
  const decoder = Decoder.fromBlob(blobWithMetadata);
  const metadata = decoder.bytesBlob().raw;
  const code = blobWithMetadata.subarray(decoder.bytesRead());
  return { metadata, code };
}
