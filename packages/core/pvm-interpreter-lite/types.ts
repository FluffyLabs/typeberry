import type { Memory } from "./memory.js";
import type { Registers } from "./registers.js";

/**
 * Exit codes returned by instruction handlers.
 *
 * Values >= EXIT_HALT (0x1000000) signal exit from the execution loop.
 * PVM code never exceeds 2^24 bytes, so these values are unambiguous.
 *
 * We don't use -Status.X because Status.HALT = 0 and -0 === 0 in JS.
 */
export const EXIT_HALT = 0x1000000; // maps to Status.HALT (0)
export const EXIT_PANIC = 0x1000001; // maps to Status.PANIC (1)
export const EXIT_FAULT = 0x1000002; // maps to Status.FAULT (2)
export const EXIT_HOST = 0x1000003; // maps to Status.HOST (3)

/**
 * Mutable context passed to every instruction handler.
 * Pre-allocated once, zero allocations in the hot loop.
 */
export type InterpreterContext = {
  readonly regs: Registers;
  readonly mem: Memory;
  blocks: Uint8Array;
  jumpTable: Uint32Array;
  jumpTableSize: number;
  // ---- side-channel output from handlers (set ONLY at exit) ----
  exitParam: number; // HOST: host call index, FAULT: fault address
  nextPc: number; // HOST: PC after ECALLI (for resume)
  // ---- pre-allocated buffer for load/store (8 bytes max) ----
  readonly regBuf: Uint8Array;
};

/**
 * Signature of every instruction handler.
 *
 * Returns:
 * - < EXIT_HALT: next PC (continue execution)
 * - >= EXIT_HALT: exit code (HALT/PANIC/FAULT/HOST)
 *
 * On exit, handler sets ctx.exitParam and/or ctx.nextPc as needed.
 */
export type InstructionHandler = (ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array) => number;
