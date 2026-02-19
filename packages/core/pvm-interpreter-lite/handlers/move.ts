import { clampReg, readSignedImm } from "../helpers.js";
import type { InterpreterContext } from "../types.js";

// ============ TWO_REGISTERS: move_reg ============
// TWO_REGISTERS: firstRegisterIndex = high nibble, secondRegisterIndex = low nibble
// move_reg: copies value of first (source, high nibble) into second (dest, low nibble)

export function handleMoveReg(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b >> 4);
  const rd = clampReg(b & 0xf);
  ctx.regs.setU64(rd, ctx.regs.getU64(ra));
  return pc + 1 + skip[pc + 1];
}

// ============ THREE_REGISTERS: cmov ============

export function handleCmovIz(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  if (ctx.regs.getU64(rb) === 0n) {
    ctx.regs.setU64(rd, ctx.regs.getU64(ra));
  }
  return pc + 1 + skip[pc + 1];
}

export function handleCmovNz(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  if (ctx.regs.getU64(rb) !== 0n) {
    ctx.regs.setU64(rd, ctx.regs.getU64(ra));
  }
  return pc + 1 + skip[pc + 1];
}

// ============ TWO_REGISTERS_ONE_IMMEDIATE: cmov_imm ============

export function handleCmovIzImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = readSignedImm(code, pc + 2, immLen);
  if (ctx.regs.getU64(rb) === 0n) {
    ctx.regs.setU32(ra, imm);
  }
  return pc + dist;
}

export function handleCmovNzImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = readSignedImm(code, pc + 2, immLen);
  if (ctx.regs.getU64(rb) !== 0n) {
    ctx.regs.setU32(ra, imm);
  }
  return pc + dist;
}

// ============ THREE_REGISTERS: set_lt ============

export function handleSetLtU(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU32(rd, ctx.regs.getU64(ra) < ctx.regs.getU64(rb) ? 1 : 0);
  return pc + 1 + skip[pc + 1];
}

export function handleSetLtS(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU32(rd, ctx.regs.getI64(ra) < ctx.regs.getI64(rb) ? 1 : 0);
  return pc + 1 + skip[pc + 1];
}

// ============ TWO_REGISTERS_ONE_IMMEDIATE: set_lt_imm, set_gt_imm ============

export function handleSetLtUImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = BigInt(readSignedImm(code, pc + 2, immLen));
  ctx.regs.setU32(ra, ctx.regs.getU64(rb) < BigInt.asUintN(64, imm) ? 1 : 0);
  return pc + dist;
}

export function handleSetLtSImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = BigInt(readSignedImm(code, pc + 2, immLen));
  ctx.regs.setU32(ra, ctx.regs.getI64(rb) < BigInt.asIntN(64, imm) ? 1 : 0);
  return pc + dist;
}

export function handleSetGtUImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = BigInt(readSignedImm(code, pc + 2, immLen));
  ctx.regs.setU32(ra, ctx.regs.getU64(rb) > BigInt.asUintN(64, imm) ? 1 : 0);
  return pc + dist;
}

export function handleSetGtSImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = BigInt(readSignedImm(code, pc + 2, immLen));
  ctx.regs.setU32(ra, ctx.regs.getI64(rb) > BigInt.asIntN(64, imm) ? 1 : 0);
  return pc + dist;
}
