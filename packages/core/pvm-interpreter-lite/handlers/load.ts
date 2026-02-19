import { clampReg, readImm64, readSignedImm } from "../helpers.js";
import type { InterpreterContext } from "../types.js";
import { EXIT_FAULT, EXIT_PANIC } from "../types.js";

// Helper: handle load result (fault codes)
function handleFault(ctx: InterpreterContext, fault: number, address: number): number {
  if (fault === 1) {
    ctx.exitParam = address >>> 0;
    return EXIT_FAULT;
  }
  // fault === 2 means access fault -> PANIC
  return EXIT_PANIC;
}

// Helper: load unsigned value from memory into register
function loadUnsigned(ctx: InterpreterContext, address: number, rd: number, byteCount: number): number {
  const buf = ctx.regBuf;
  const fault = ctx.mem.fastLoad(buf.subarray(0, byteCount), address);
  if (fault !== 0) {
    return fault;
  }
  // Zero-extend to 64-bit: write loaded bytes + zero the rest
  const bytes = ctx.regs.bytes;
  const regOff = rd << 3;
  for (let i = 0; i < byteCount; i++) {
    bytes[regOff + i] = buf[i];
  }
  for (let i = byteCount; i < 8; i++) {
    bytes[regOff + i] = 0;
  }
  return 0;
}

// Helper: load signed value from memory into register
function loadSigned(ctx: InterpreterContext, address: number, rd: number, byteCount: number): number {
  const buf = ctx.regBuf;
  const fault = ctx.mem.fastLoad(buf.subarray(0, byteCount), address);
  if (fault !== 0) {
    return fault;
  }
  // Sign-extend: check MSB of loaded data
  const bytes = ctx.regs.bytes;
  const regOff = rd << 3;
  const msb = buf[byteCount - 1];
  const fill = msb & 0x80 ? 0xff : 0x00;
  for (let i = 0; i < byteCount; i++) {
    bytes[regOff + i] = buf[i];
  }
  for (let i = byteCount; i < 8; i++) {
    bytes[regOff + i] = fill;
  }
  return 0;
}

// ============ ONE_REGISTER_ONE_IMMEDIATE: load direct ============

function decode1r1i(code: Uint8Array, pc: number, skip: Uint8Array): [number, number, number] {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = readSignedImm(code, pc + 2, immLen);
  return [ra, imm, dist];
}

/** LOAD_IMM - load signed immediate into register (sign-extended to 64-bit) */
export function handleLoadImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, imm, dist] = decode1r1i(code, pc, skip);
  ctx.regs.setU32(ra, imm); // setU32 does sign-extension to 64-bit
  return pc + dist;
}

/** LOAD_IMM_64 - load extended-width 64-bit immediate */
export function handleLoadImm64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const imm = readImm64(code, pc + 2, 8);
  ctx.regs.setU64(ra, imm);
  // ONE_REGISTER_ONE_EXTENDED_WIDTH_IMMEDIATE has fixed length
  return pc + 1 + skip[pc + 1];
}

export function handleLoadU8(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, imm, dist] = decode1r1i(code, pc, skip);
  const address = imm >>> 0;
  const fault = loadUnsigned(ctx, address, ra, 1);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleLoadI8(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, imm, dist] = decode1r1i(code, pc, skip);
  const address = imm >>> 0;
  const fault = loadSigned(ctx, address, ra, 1);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleLoadU16(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, imm, dist] = decode1r1i(code, pc, skip);
  const address = imm >>> 0;
  const fault = loadUnsigned(ctx, address, ra, 2);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleLoadI16(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, imm, dist] = decode1r1i(code, pc, skip);
  const address = imm >>> 0;
  const fault = loadSigned(ctx, address, ra, 2);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleLoadU32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, imm, dist] = decode1r1i(code, pc, skip);
  const address = imm >>> 0;
  const fault = loadUnsigned(ctx, address, ra, 4);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleLoadI32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, imm, dist] = decode1r1i(code, pc, skip);
  const address = imm >>> 0;
  const fault = loadSigned(ctx, address, ra, 4);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleLoadU64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, imm, dist] = decode1r1i(code, pc, skip);
  const address = imm >>> 0;
  const fault = loadUnsigned(ctx, address, ra, 8);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

// ============ TWO_REGISTERS_ONE_IMMEDIATE: load indirect (reg + imm) ============

function decode2r1iForLoad(code: Uint8Array, pc: number, skip: Uint8Array): [number, number, number, number] {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = readSignedImm(code, pc + 2, immLen);
  return [ra, rb, imm, dist];
}

export function handleLoadIndU8(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1iForLoad(code, pc, skip);
  const address = ((ctx.regs.getU32(rb) >>> 0) + imm) >>> 0;
  const fault = loadUnsigned(ctx, address, ra, 1);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleLoadIndI8(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1iForLoad(code, pc, skip);
  const address = ((ctx.regs.getU32(rb) >>> 0) + imm) >>> 0;
  const fault = loadSigned(ctx, address, ra, 1);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleLoadIndU16(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1iForLoad(code, pc, skip);
  const address = ((ctx.regs.getU32(rb) >>> 0) + imm) >>> 0;
  const fault = loadUnsigned(ctx, address, ra, 2);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleLoadIndI16(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1iForLoad(code, pc, skip);
  const address = ((ctx.regs.getU32(rb) >>> 0) + imm) >>> 0;
  const fault = loadSigned(ctx, address, ra, 2);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleLoadIndU32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1iForLoad(code, pc, skip);
  const address = ((ctx.regs.getU32(rb) >>> 0) + imm) >>> 0;
  const fault = loadUnsigned(ctx, address, ra, 4);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleLoadIndI32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1iForLoad(code, pc, skip);
  const address = ((ctx.regs.getU32(rb) >>> 0) + imm) >>> 0;
  const fault = loadSigned(ctx, address, ra, 4);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleLoadIndU64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1iForLoad(code, pc, skip);
  const address = ((ctx.regs.getU32(rb) >>> 0) + imm) >>> 0;
  const fault = loadUnsigned(ctx, address, ra, 8);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}
