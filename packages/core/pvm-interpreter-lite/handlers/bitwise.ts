import { clampReg, clz64, countBits32, countBits64, ctz32, ctz64, readSignedImm } from "../helpers.js";
import type { InterpreterContext } from "../types.js";

// ============ THREE_REGISTERS bitwise ============

export function handleAnd(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU64(rd, ctx.regs.getU64(ra) & ctx.regs.getU64(rb));
  return pc + 1 + skip[pc + 1];
}

export function handleXor(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU64(rd, ctx.regs.getU64(ra) ^ ctx.regs.getU64(rb));
  return pc + 1 + skip[pc + 1];
}

export function handleOr(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU64(rd, ctx.regs.getU64(ra) | ctx.regs.getU64(rb));
  return pc + 1 + skip[pc + 1];
}

export function handleAndInv(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU64(rd, BigInt.asUintN(64, ctx.regs.getU64(ra) & ~ctx.regs.getU64(rb)));
  return pc + 1 + skip[pc + 1];
}

export function handleOrInv(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU64(rd, BigInt.asUintN(64, ctx.regs.getU64(ra) | ~ctx.regs.getU64(rb)));
  return pc + 1 + skip[pc + 1];
}

export function handleXnor(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU64(rd, BigInt.asUintN(64, ~(ctx.regs.getU64(ra) ^ ctx.regs.getU64(rb))));
  return pc + 1 + skip[pc + 1];
}

// ============ TWO_REGISTERS_ONE_IMMEDIATE bitwise ============

export function handleAndImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = BigInt(readSignedImm(code, pc + 2, immLen));
  ctx.regs.setU64(ra, BigInt.asUintN(64, ctx.regs.getU64(rb) & imm));
  return pc + dist;
}

export function handleXorImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = BigInt(readSignedImm(code, pc + 2, immLen));
  ctx.regs.setU64(ra, BigInt.asUintN(64, ctx.regs.getU64(rb) ^ imm));
  return pc + dist;
}

export function handleOrImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = BigInt(readSignedImm(code, pc + 2, immLen));
  ctx.regs.setU64(ra, BigInt.asUintN(64, ctx.regs.getU64(rb) | imm));
  return pc + dist;
}

// ============ TWO_REGISTERS: bit manipulation ============

// TWO_REGISTERS: firstRegisterIndex = high nibble, secondRegisterIndex = low nibble
// In the old code: first = getHighNibbleAsRegisterIndex, second = getLowNibbleAsRegisterIndex
// So: ra = high nibble (source), rd = low nibble (dest)

export function handleCountSetBits64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b >> 4);
  const rd = clampReg(b & 0xf);
  ctx.regs.setU32(rd, countBits64(ctx.regs.getU64(ra)));
  return pc + 1 + skip[pc + 1];
}

export function handleCountSetBits32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b >> 4);
  const rd = clampReg(b & 0xf);
  ctx.regs.setU32(rd, countBits32(ctx.regs.getU32(ra) >>> 0));
  return pc + 1 + skip[pc + 1];
}

export function handleLeadingZeroBits64(
  ctx: InterpreterContext,
  pc: number,
  code: Uint8Array,
  skip: Uint8Array,
): number {
  const b = code[pc + 1];
  const ra = clampReg(b >> 4);
  const rd = clampReg(b & 0xf);
  ctx.regs.setU32(rd, clz64(ctx.regs.getU64(ra)));
  return pc + 1 + skip[pc + 1];
}

export function handleLeadingZeroBits32(
  ctx: InterpreterContext,
  pc: number,
  code: Uint8Array,
  skip: Uint8Array,
): number {
  const b = code[pc + 1];
  const ra = clampReg(b >> 4);
  const rd = clampReg(b & 0xf);
  ctx.regs.setU32(rd, Math.clz32(ctx.regs.getU32(ra) >>> 0));
  return pc + 1 + skip[pc + 1];
}

export function handleTrailingZeroBits64(
  ctx: InterpreterContext,
  pc: number,
  code: Uint8Array,
  skip: Uint8Array,
): number {
  const b = code[pc + 1];
  const ra = clampReg(b >> 4);
  const rd = clampReg(b & 0xf);
  ctx.regs.setU32(rd, ctz64(ctx.regs.getU64(ra)));
  return pc + 1 + skip[pc + 1];
}

export function handleTrailingZeroBits32(
  ctx: InterpreterContext,
  pc: number,
  code: Uint8Array,
  skip: Uint8Array,
): number {
  const b = code[pc + 1];
  const ra = clampReg(b >> 4);
  const rd = clampReg(b & 0xf);
  ctx.regs.setU32(rd, ctz32(ctx.regs.getU32(ra)));
  return pc + 1 + skip[pc + 1];
}

export function handleSignExtend8(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b >> 4);
  const rd = clampReg(b & 0xf);
  const val = ctx.regs.getU64(ra);
  const byte = Number(val & 0xffn);
  // Sign-extend 8-bit to 64-bit
  const extended = (byte << 24) >> 24; // sign-extend via shift in JS i32
  ctx.regs.setU64(rd, BigInt.asUintN(64, BigInt(extended)));
  return pc + 1 + skip[pc + 1];
}

export function handleSignExtend16(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b >> 4);
  const rd = clampReg(b & 0xf);
  const val = ctx.regs.getU64(ra);
  const halfword = Number(val & 0xffffn);
  const extended = (halfword << 16) >> 16;
  ctx.regs.setU64(rd, BigInt.asUintN(64, BigInt(extended)));
  return pc + 1 + skip[pc + 1];
}

export function handleZeroExtend16(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b >> 4);
  const rd = clampReg(b & 0xf);
  const val = ctx.regs.getU64(ra);
  ctx.regs.setU64(rd, val & 0xffffn);
  return pc + 1 + skip[pc + 1];
}

export function handleReverseBytes(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b >> 4);
  const rd = clampReg(b & 0xf);
  const val = ctx.regs.getU64(ra);
  // Reverse 8 bytes of a 64-bit value
  let result = 0n;
  for (let i = 0; i < 8; i++) {
    result |= ((val >> BigInt(i * 8)) & 0xffn) << BigInt((7 - i) * 8);
  }
  ctx.regs.setU64(rd, result);
  return pc + 1 + skip[pc + 1];
}
