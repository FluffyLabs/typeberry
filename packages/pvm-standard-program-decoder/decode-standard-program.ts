import { Decoder } from "@typeberry/codec";
import { type Opaque, ensure } from "@typeberry/utils";
import { ARGS_SEGMENT, DATA_LEGNTH, LAST_PAGE, PAGE_SIZE, SEGMENT_SIZE, STACK_SEGMENT } from "./memory-conts";
import { alignToPageSize, alignToSegmentSize } from "./memory-utils";

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
 * GP reference: https://graypaper.fluffylabs.dev/#WyIxYjA4MWZlM2U3IiwiMjciLG51bGwsbnVsbCxbIjxkaXYgY2xhc3M9XCJ0IG0wIHgxMCBoNiB5MTUzMCBmZjcgZnMwIGZjMCBzYzAgbHMwIHdzMFwiPiIsIjxkaXYgY2xhc3M9XCJ0IG0wIHgxMCBoNiB5MTUzOCBmZjcgZnMwIGZjMCBzYzAgbHMwIHdzMFwiPiJdXQ==
 */
type InputLength = Opaque<number, "Number that is lower than 2 ** 24 (Z_I from GP)">;

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
  const readonlyDataEnd = SEGMENT_SIZE + readOnlyLength;
  const readOnlyZerosEnd = SEGMENT_SIZE + alignToPageSize(readOnlyLength);
  const heapDataStart = 2 * SEGMENT_SIZE + alignToSegmentSize(readOnlyLength);
  const heapDataEnd = heapDataStart + heapLength;
  const heapZerosEnd = heapDataStart + alignToPageSize(heapLength) + noOfHeapZerosPages * PAGE_SIZE;
  const stackStart = STACK_SEGMENT - alignToPageSize(stackSize);
  const stackEnd = STACK_SEGMENT;
  const argsStart = ARGS_SEGMENT;
  const argsEnd = argsStart + argsLength;
  const argsZerosEnd = argsEnd + alignToPageSize(argsLength);

  return {
    code,
    memory: {
      readable: [
        getMemorySegment(readonlyDataStart, readonlyDataEnd, readOnlyMemory),
        getMemorySegment(readonlyDataEnd, readOnlyZerosEnd),
        getMemorySegment(argsStart, argsEnd, args),
        getMemorySegment(argsEnd, argsZerosEnd),
      ],
      writeable: [
        getMemorySegment(heapDataStart, heapDataEnd, initialHeap),
        getMemorySegment(heapDataEnd, heapZerosEnd),
        getMemorySegment(stackStart, stackEnd),
      ],

      sbrkIndex: heapZerosEnd,
    },
    registers: getRegisters(args.length),
  };
}

function getMemorySegment(start: number, end: number, data: Uint8Array | null = null) {
  return { start, end, data };
}

function getRegisters(argsLength: number) {
  const regs = new Uint8Array(NO_OF_REGISTERS);

  // GP reference: https://graypaper.fluffylabs.dev/#WyIxYjA4MWZlM2U3IiwiMjciLG51bGwsbnVsbCxbIjxkaXYgY2xhc3M9XCJ0IG0wIHgxMCBoYyB5MTU5OSBmZjcgZnMwIGZjMCBzYzAgbHMwIHdzMFwiPiIsIjxkaXYgY2xhc3M9XCJ0IG0wIHgxMCBoYyB5MTU5OSBmZjcgZnMwIGZjMCBzYzAgbHMwIHdzMFwiPiJdXQ==
  regs[1] = LAST_PAGE;
  regs[2] = STACK_SEGMENT;
  regs[10] = ARGS_SEGMENT;
  regs[11] = argsLength;

  return regs;
}
