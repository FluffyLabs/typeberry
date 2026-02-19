import { clampReg, readUnsignedImm32 } from "../helpers.js";
import type { InterpreterContext } from "../types.js";
import { EXIT_FAULT, EXIT_HOST, EXIT_PANIC } from "../types.js";

/** TRAP and unknown opcodes -> PANIC */
export function handleTrap(_ctx: InterpreterContext, _pc: number, _code: Uint8Array, _skip: Uint8Array): number {
  return EXIT_PANIC;
}

/** FALLTHROUGH - no-op, advance to next instruction */
export function handleFallthrough(_ctx: InterpreterContext, pc: number, _code: Uint8Array, skip: Uint8Array): number {
  return pc + 1 + (skip[pc + 1] ?? 0);
}

/**
 * ECALLI - host call.
 * Argument type: ONE_IMMEDIATE
 * Reads host call index from immediate, sets exitParam and nextPc, returns EXIT_HOST.
 */
export function handleEcalli(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const dist = 1 + skip[pc + 1];
  const immLen = Math.min(4, dist - 1);
  ctx.exitParam = readUnsignedImm32(code, pc + 1, immLen);
  ctx.nextPc = pc + dist;
  return EXIT_HOST;
}

/**
 * SBRK - grow heap.
 * Argument type: TWO_REGISTERS (first=source/high nibble, second=dest/low nibble)
 *
 * Note: TWO_REGISTERS format for this instruction type:
 * first byte after opcode: low nibble = first (high nibble in old), high nibble = second (low nibble in old)
 * In the old interpreter: firstRegisterIndex = getHighNibble, secondRegisterIndex = getLowNibble
 * So: ra = high nibble = source, rd = low nibble = destination
 */
export function handleSbrk(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  // TWO_REGISTERS: firstRegisterIndex = high nibble, secondRegisterIndex = low nibble
  const ra = clampReg(b >> 4);
  const rd = clampReg(b & 0xf);

  const length = ctx.regs.getU32(ra) >>> 0; // lower U32 as unsigned
  const oldSbrk = ctx.mem.sbrk(length);
  if (oldSbrk === -1) {
    // Out of memory -> FAULT
    ctx.exitParam = 0;
    return EXIT_FAULT;
  }
  ctx.regs.setU32(rd, oldSbrk);
  return pc + 1 + skip[pc + 1];
}
