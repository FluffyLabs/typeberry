import {
  addU32,
  addU64,
  clampReg,
  mulU32,
  mulU64,
  mulUpperSS,
  mulUpperSU,
  mulUpperUU,
  readSignedImm,
  subU32,
  subU64,
} from "../helpers.js";
import type { InterpreterContext } from "../types.js";

// ============ THREE_REGISTERS: ra=low(byte1), rb=high(byte1), rd=low(byte2) ============

// ---- 32-bit arithmetic (Number fast path) ----

export function handleAdd32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU32(rd, addU32(ctx.regs.getU32(ra), ctx.regs.getU32(rb)));
  return pc + 1 + skip[pc + 1];
}

export function handleSub32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU32(rd, subU32(ctx.regs.getU32(ra), ctx.regs.getU32(rb)));
  return pc + 1 + skip[pc + 1];
}

export function handleMul32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU32(rd, mulU32(ctx.regs.getU32(ra), ctx.regs.getU32(rb)));
  return pc + 1 + skip[pc + 1];
}

// ---- 64-bit arithmetic (BigInt) ----

export function handleAdd64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU64(rd, addU64(ctx.regs.getU64(ra), ctx.regs.getU64(rb)));
  return pc + 1 + skip[pc + 1];
}

export function handleSub64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU64(rd, subU64(ctx.regs.getU64(ra), ctx.regs.getU64(rb)));
  return pc + 1 + skip[pc + 1];
}

export function handleMul64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU64(rd, mulU64(ctx.regs.getU64(ra), ctx.regs.getU64(rb)));
  return pc + 1 + skip[pc + 1];
}

export function handleMulUpperUU(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU64(rd, mulUpperUU(ctx.regs.getU64(ra), ctx.regs.getU64(rb)));
  return pc + 1 + skip[pc + 1];
}

export function handleMulUpperSS(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU64(rd, mulUpperSS(ctx.regs.getU64(ra), ctx.regs.getU64(rb)));
  return pc + 1 + skip[pc + 1];
}

export function handleMulUpperSU(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU64(rd, mulUpperSU(ctx.regs.getU64(ra), ctx.regs.getU64(rb)));
  return pc + 1 + skip[pc + 1];
}

// ---- Division 32-bit ----

export function handleDivU32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  const divisor = ctx.regs.getU32(rb) >>> 0;
  if (divisor === 0) {
    // div by 0 → all 1s (0xFFFFFFFF, sign-extended to 64-bit = 0xFFFFFFFFFFFFFFFF)
    ctx.regs.setU64(rd, 0xffffffffffffffffn);
  } else {
    ctx.regs.setU32(rd, ((ctx.regs.getU32(ra) >>> 0) / divisor) | 0);
  }
  return pc + 1 + skip[pc + 1];
}

export function handleDivS32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  const dividend = ctx.regs.getI32(ra);
  const divisor = ctx.regs.getI32(rb);
  if (divisor === 0) {
    ctx.regs.setU64(rd, 0xffffffffffffffffn);
  } else if (dividend === (-2147483648 | 0) && divisor === -1) {
    // MIN_I32 / -1 = MIN_I32 (overflow)
    ctx.regs.setU32(rd, dividend);
  } else {
    ctx.regs.setU32(rd, (dividend / divisor) | 0);
  }
  return pc + 1 + skip[pc + 1];
}

// ---- Division 64-bit ----

export function handleDivU64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  const divisor = ctx.regs.getU64(rb);
  if (divisor === 0n) {
    ctx.regs.setU64(rd, 0xffffffffffffffffn);
  } else {
    ctx.regs.setU64(rd, ctx.regs.getU64(ra) / divisor);
  }
  return pc + 1 + skip[pc + 1];
}

export function handleDivS64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  const dividend = ctx.regs.getI64(ra);
  const divisor = ctx.regs.getI64(rb);
  if (divisor === 0n) {
    ctx.regs.setU64(rd, 0xffffffffffffffffn);
  } else if (dividend === -(2n ** 63n) && divisor === -1n) {
    ctx.regs.setU64(rd, BigInt.asUintN(64, dividend));
  } else {
    // BigInt division truncates toward zero
    ctx.regs.setU64(rd, BigInt.asUintN(64, dividend / divisor));
  }
  return pc + 1 + skip[pc + 1];
}

// ---- Remainder 32-bit ----

export function handleRemU32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  const divisor = ctx.regs.getU32(rb) >>> 0;
  if (divisor === 0) {
    // rem by 0 → dividend
    ctx.regs.setU32(rd, ctx.regs.getU32(ra));
  } else {
    ctx.regs.setU32(rd, ((ctx.regs.getU32(ra) >>> 0) % divisor) | 0);
  }
  return pc + 1 + skip[pc + 1];
}

export function handleRemS32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  const dividend = ctx.regs.getI32(ra);
  const divisor = ctx.regs.getI32(rb);
  if (divisor === 0) {
    ctx.regs.setU32(rd, dividend);
  } else if (dividend === (-2147483648 | 0) && divisor === -1) {
    ctx.regs.setU32(rd, 0);
  } else {
    ctx.regs.setU32(rd, (dividend % divisor) | 0);
  }
  return pc + 1 + skip[pc + 1];
}

// ---- Remainder 64-bit ----

export function handleRemU64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  const divisor = ctx.regs.getU64(rb);
  if (divisor === 0n) {
    ctx.regs.setU64(rd, ctx.regs.getU64(ra));
  } else {
    ctx.regs.setU64(rd, ctx.regs.getU64(ra) % divisor);
  }
  return pc + 1 + skip[pc + 1];
}

export function handleRemS64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  const dividend = ctx.regs.getI64(ra);
  const divisor = ctx.regs.getI64(rb);
  if (divisor === 0n) {
    ctx.regs.setU64(rd, BigInt.asUintN(64, dividend));
  } else if (dividend === -(2n ** 63n) && divisor === -1n) {
    ctx.regs.setU64(rd, 0n);
  } else {
    ctx.regs.setU64(rd, BigInt.asUintN(64, dividend % divisor));
  }
  return pc + 1 + skip[pc + 1];
}

// ---- Min/Max (THREE_REGISTERS) ----

export function handleMax(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  const a = ctx.regs.getI64(ra);
  const bv = ctx.regs.getI64(rb);
  ctx.regs.setU64(rd, a > bv ? ctx.regs.getU64(ra) : ctx.regs.getU64(rb));
  return pc + 1 + skip[pc + 1];
}

export function handleMaxU(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  const a = ctx.regs.getU64(ra);
  const bv = ctx.regs.getU64(rb);
  ctx.regs.setU64(rd, a > bv ? a : bv);
  return pc + 1 + skip[pc + 1];
}

export function handleMin(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  const a = ctx.regs.getI64(ra);
  const bv = ctx.regs.getI64(rb);
  ctx.regs.setU64(rd, a < bv ? ctx.regs.getU64(ra) : ctx.regs.getU64(rb));
  return pc + 1 + skip[pc + 1];
}

export function handleMinU(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  const a = ctx.regs.getU64(ra);
  const bv = ctx.regs.getU64(rb);
  ctx.regs.setU64(rd, a < bv ? a : bv);
  return pc + 1 + skip[pc + 1];
}

// ============ TWO_REGISTERS_ONE_IMMEDIATE: ra=low(byte1), rb=high(byte1), imm from byte2+ ============

export function handleAddImm32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = readSignedImm(code, pc + 2, immLen);
  ctx.regs.setU32(ra, addU32(ctx.regs.getU32(rb), imm));
  return pc + dist;
}

export function handleAddImm64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = BigInt(readSignedImm(code, pc + 2, immLen));
  ctx.regs.setU64(ra, addU64(ctx.regs.getU64(rb), imm));
  return pc + dist;
}

export function handleMulImm32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = readSignedImm(code, pc + 2, immLen);
  ctx.regs.setU32(ra, mulU32(ctx.regs.getU32(rb), imm));
  return pc + dist;
}

export function handleMulImm64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = BigInt(readSignedImm(code, pc + 2, immLen));
  ctx.regs.setU64(ra, mulU64(ctx.regs.getU64(rb), imm));
  return pc + dist;
}

export function handleNegAddImm32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = readSignedImm(code, pc + 2, immLen);
  ctx.regs.setU32(ra, subU32(imm, ctx.regs.getU32(rb)));
  return pc + dist;
}

export function handleNegAddImm64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = BigInt(readSignedImm(code, pc + 2, immLen));
  ctx.regs.setU64(ra, subU64(imm, ctx.regs.getU64(rb)));
  return pc + dist;
}
