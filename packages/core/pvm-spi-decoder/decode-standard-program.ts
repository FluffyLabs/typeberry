import { Decoder } from "@typeberry/codec";
import { type Opaque, WithDebug, ensure } from "@typeberry/utils";
import { ARGS_SEGMENT, DATA_LEGNTH, LAST_PAGE, PAGE_SIZE, SEGMENT_SIZE, STACK_SEGMENT } from "./memory-conts.js";
import { alignToPageSize, alignToSegmentSize } from "./memory-utils.js";

const NO_OF_REGISTERS = 13;

/**
 * program = E_3(|o|) ++ E_3(|w|) ++ E_2(z) ++ E_3(s) ++ o ++ w ++ E_4(|c|) ++ c
 *
 * E_n - little endian encoding, n - length
 * o - initial read only data
 * w - initial heap
 * z - heap pages filled with zeros
 * s - stack size
 * c - program code
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/2b92022b9202
 */
type InputLength = Opaque<number, "Number that is lower than 2 ** 24 (Z_I from GP)">;

export class MemorySegment extends WithDebug {
  static from({ start, end, data }: Omit<MemorySegment, never>) {
    return new MemorySegment(start, end, data);
  }

  constructor(
    public readonly start: number,
    public readonly end: number,
    public readonly data: Uint8Array | null,
  ) {
    super();
  }
}
export class SpiMemory extends WithDebug {
  constructor(
    public readonly readable: MemorySegment[],
    public readonly writeable: MemorySegment[],
    public readonly sbrkIndex: number,
    public readonly heapEnd: number,
  ) {
    super();
  }
}

export class SpiProgram extends WithDebug {
  constructor(
    public readonly code: Uint8Array,
    public readonly memory: SpiMemory,
    public readonly registers: BigUint64Array,
  ) {
    super();
  }
}

export function decodeStandardProgram(program: Uint8Array, args: Uint8Array) {
  const decoder = Decoder.fromBlob(program);
  const oLength = decoder.u24();
  const wLength = decoder.u24();
  const argsLength = ensure<number, InputLength>(args.length, args.length <= DATA_LEGNTH, "Incorrect arguments length");
  const readOnlyLength = ensure<number, InputLength>(
    oLength,
    oLength <= DATA_LEGNTH,
    "Incorrect readonly segment length",
  );
  const heapLength = ensure<number, InputLength>(wLength, wLength <= DATA_LEGNTH, "Incorrect heap segment length");
  const noOfHeapZerosPages = decoder.u16();
  const stackSize = decoder.u24();
  const readOnlyMemory = decoder.bytes(readOnlyLength).raw;
  const initialHeap = decoder.bytes(heapLength).raw;
  const codeLength = decoder.u32();
  const code = decoder.bytes(codeLength).raw;
  decoder.finish();

  const readonlyDataStart = SEGMENT_SIZE;
  const readonlyDataEnd = SEGMENT_SIZE + alignToPageSize(readOnlyLength);
  const heapDataStart = 2 * SEGMENT_SIZE + alignToSegmentSize(readOnlyLength);
  const heapDataEnd = heapDataStart + alignToPageSize(heapLength);
  const heapZerosEnd = heapDataStart + alignToPageSize(heapLength) + noOfHeapZerosPages * PAGE_SIZE;
  const stackStart = STACK_SEGMENT - alignToPageSize(stackSize);
  const stackEnd = STACK_SEGMENT;
  const argsStart = ARGS_SEGMENT;
  const argsEnd = argsStart + alignToPageSize(argsLength);
  const argsZerosEnd = argsEnd + alignToPageSize(argsLength);

  function nonEmpty(s: MemorySegment | false): s is MemorySegment {
    return s !== false;
  }

  const readableMemory = [
    readOnlyLength > 0 && getMemorySegment(readonlyDataStart, readonlyDataEnd, readOnlyMemory),
    argsLength > 0 && getMemorySegment(argsStart, argsEnd, args),
    argsEnd < argsZerosEnd && getMemorySegment(argsEnd, argsZerosEnd),
  ].filter(nonEmpty);
  const writeableMemory = [
    heapLength > 0 && getMemorySegment(heapDataStart, heapDataEnd, initialHeap),
    heapDataEnd < heapZerosEnd && getMemorySegment(heapDataEnd, heapZerosEnd),
    stackStart < stackEnd && getMemorySegment(stackStart, stackEnd),
  ].filter(nonEmpty);

  return new SpiProgram(
    code,
    new SpiMemory(readableMemory, writeableMemory, heapZerosEnd, stackStart),
    getRegisters(args.length),
  );
}

function getMemorySegment(start: number, end: number, data: Uint8Array | null = null) {
  return new MemorySegment(start, end, data);
}

function getRegisters(argsLength: number) {
  const regs = new BigUint64Array(NO_OF_REGISTERS);

  // GP reference: https://graypaper.fluffylabs.dev/#/579bd12/2c7c012cb101
  regs[0] = BigInt(LAST_PAGE);
  regs[1] = BigInt(STACK_SEGMENT);
  regs[7] = BigInt(ARGS_SEGMENT);
  regs[8] = BigInt(argsLength);

  return regs;
}
