import { clampReg, readSignedImm, rotateLeft32, rotateLeft64, rotateRight32, rotateRight64 } from "../helpers.js";
import type { InterpreterContext } from "../types.js";

const MAX_SHIFT_32 = 32;
const MAX_SHIFT_64 = 64n;

// ============ THREE_REGISTERS shifts ============

export function handleShloL32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  const shift = (ctx.regs.getU32(rb) >>> 0) % MAX_SHIFT_32;
  ctx.regs.setU32(rd, (ctx.regs.getU32(ra) << shift) | 0);
  return pc + 1 + skip[pc + 1];
}

export function handleShloR32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  const shift = (ctx.regs.getU32(rb) >>> 0) % MAX_SHIFT_32;
  ctx.regs.setU32(rd, ((ctx.regs.getU32(ra) >>> 0) >>> shift) | 0);
  return pc + 1 + skip[pc + 1];
}

export function handleSharR32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  const shift = (ctx.regs.getU32(rb) >>> 0) % MAX_SHIFT_32;
  ctx.regs.setU32(rd, (ctx.regs.getI32(ra) >> shift) | 0);
  return pc + 1 + skip[pc + 1];
}

export function handleShloL64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  const shift = ctx.regs.getU64(rb) % MAX_SHIFT_64;
  ctx.regs.setU64(rd, BigInt.asUintN(64, ctx.regs.getU64(ra) << shift));
  return pc + 1 + skip[pc + 1];
}

export function handleShloR64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  const shift = ctx.regs.getU64(rb) % MAX_SHIFT_64;
  ctx.regs.setU64(rd, BigInt.asUintN(64, ctx.regs.getU64(ra)) >> shift);
  return pc + 1 + skip[pc + 1];
}

export function handleSharR64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  const shift = ctx.regs.getU64(rb) % MAX_SHIFT_64;
  const val = ctx.regs.getI64(ra);
  ctx.regs.setU64(rd, BigInt.asUintN(64, val >> shift));
  return pc + 1 + skip[pc + 1];
}

// ============ TWO_REGISTERS_ONE_IMMEDIATE shifts ============

function decode2r1i(code: Uint8Array, pc: number, skip: Uint8Array): [number, number, number, number] {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  return [ra, rb, readSignedImm(code, pc + 2, immLen), dist];
}

// Standard: shift register by immediate
export function handleShloLImm32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  const shift = (imm >>> 0) % MAX_SHIFT_32;
  ctx.regs.setU32(ra, (ctx.regs.getU32(rb) << shift) | 0);
  return pc + dist;
}

export function handleShloRImm32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  const shift = (imm >>> 0) % MAX_SHIFT_32;
  ctx.regs.setU32(ra, ((ctx.regs.getU32(rb) >>> 0) >>> shift) | 0);
  return pc + dist;
}

export function handleSharRImm32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  const shift = (imm >>> 0) % MAX_SHIFT_32;
  ctx.regs.setU32(ra, (ctx.regs.getI32(rb) >> shift) | 0);
  return pc + dist;
}

export function handleShloLImm64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  const shift = (BigInt(imm) & 0xffffffffn) % MAX_SHIFT_64;
  ctx.regs.setU64(ra, BigInt.asUintN(64, ctx.regs.getU64(rb) << shift));
  return pc + dist;
}

export function handleShloRImm64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  const shift = (BigInt(imm) & 0xffffffffn) % MAX_SHIFT_64;
  ctx.regs.setU64(ra, BigInt.asUintN(64, ctx.regs.getU64(rb)) >> shift);
  return pc + dist;
}

export function handleSharRImm64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  const shift = (BigInt(imm) & 0xffffffffn) % MAX_SHIFT_64;
  const val = ctx.regs.getI64(rb);
  ctx.regs.setU64(ra, BigInt.asUintN(64, val >> shift));
  return pc + dist;
}

// Alternative: shift immediate by register (reversed operands)
export function handleShloLImmAlt32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  const shift = (ctx.regs.getU32(rb) >>> 0) % MAX_SHIFT_32;
  ctx.regs.setU32(ra, ((imm >>> 0) << shift) | 0);
  return pc + dist;
}

export function handleShloRImmAlt32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  const shift = (ctx.regs.getU32(rb) >>> 0) % MAX_SHIFT_32;
  ctx.regs.setU32(ra, ((imm >>> 0) >>> shift) | 0);
  return pc + dist;
}

export function handleSharRImmAlt32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  const shift = (ctx.regs.getU32(rb) >>> 0) % MAX_SHIFT_32;
  ctx.regs.setU32(ra, ((imm | 0) >> shift) | 0);
  return pc + dist;
}

export function handleShloLImmAlt64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  const shift = ctx.regs.getU64(rb) % MAX_SHIFT_64;
  const immBig = BigInt(imm);
  ctx.regs.setU64(ra, BigInt.asUintN(64, immBig << shift));
  return pc + dist;
}

export function handleShloRImmAlt64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  const shift = ctx.regs.getU64(rb) % MAX_SHIFT_64;
  const immBig = BigInt.asUintN(64, BigInt(imm));
  ctx.regs.setU64(ra, immBig >> shift);
  return pc + dist;
}

export function handleSharRImmAlt64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  const shift = ctx.regs.getU64(rb) % MAX_SHIFT_64;
  const immBig = BigInt.asIntN(64, BigInt(imm));
  ctx.regs.setU64(ra, BigInt.asUintN(64, immBig >> shift));
  return pc + dist;
}

// ============ Rotations (THREE_REGISTERS) ============

export function handleRotL64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU64(rd, rotateLeft64(ctx.regs.getU64(ra), ctx.regs.getU64(rb)));
  return pc + 1 + skip[pc + 1];
}

export function handleRotL32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU32(rd, rotateLeft32(ctx.regs.getU32(ra), ctx.regs.getU32(rb)));
  return pc + 1 + skip[pc + 1];
}

export function handleRotR64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU64(rd, rotateRight64(ctx.regs.getU64(ra), ctx.regs.getU64(rb)));
  return pc + 1 + skip[pc + 1];
}

export function handleRotR32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const rd = clampReg(code[pc + 2] & 0xf);
  ctx.regs.setU32(rd, rotateRight32(ctx.regs.getU32(ra), ctx.regs.getU32(rb)));
  return pc + 1 + skip[pc + 1];
}

// ============ Rotations (TWO_REGISTERS_ONE_IMMEDIATE) ============

export function handleRotR64Imm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  ctx.regs.setU64(ra, rotateRight64(ctx.regs.getU64(rb), BigInt(imm) & 0xffffffffn));
  return pc + dist;
}

export function handleRotR64ImmAlt(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  ctx.regs.setU64(ra, rotateRight64(BigInt.asUintN(64, BigInt(imm)), ctx.regs.getU64(rb)));
  return pc + dist;
}

export function handleRotR32Imm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  ctx.regs.setU32(ra, rotateRight32(ctx.regs.getU32(rb), imm));
  return pc + dist;
}

export function handleRotR32ImmAlt(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  ctx.regs.setU32(ra, rotateRight32(imm, ctx.regs.getU32(rb)));
  return pc + dist;
}
