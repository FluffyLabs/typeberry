import { clampLen, clampReg, readSignedImm } from "../helpers.js";
import type { InterpreterContext } from "../types.js";
import { EXIT_FAULT, EXIT_PANIC } from "../types.js";

// Helper: handle store fault
function handleFault(ctx: InterpreterContext, fault: number, address: number): number {
  if (fault === 2) {
    // Access fault (write to read-only page) -> PANIC
    return EXIT_PANIC;
  }
  // fault === 1: page not mapped
  ctx.exitParam = address >>> 0;
  return EXIT_FAULT;
}

// Helper: store register bytes to memory
function storeRegBytes(ctx: InterpreterContext, address: number, rd: number, byteCount: number): number {
  const bytes = ctx.regs.bytes;
  const regOff = rd << 3;
  const buf = ctx.regBuf;
  for (let i = 0; i < byteCount; i++) {
    buf[i] = bytes[regOff + i];
  }
  return ctx.mem.fastStore(address, buf.subarray(0, byteCount));
}

// Helper: store immediate bytes to memory
function storeImmBytes(ctx: InterpreterContext, address: number, imm: number, byteCount: number): number {
  const buf = ctx.regBuf;
  for (let i = 0; i < byteCount; i++) {
    buf[i] = (imm >> (i << 3)) & 0xff;
  }
  return ctx.mem.fastStore(address, buf.subarray(0, byteCount));
}

// Helper: store 64-bit sign-extended immediate to memory (atomic — single fastStore call)
function storeImmBytes64(ctx: InterpreterContext, address: number, imm: number): number {
  const buf = ctx.regBuf;
  // Lower 4 bytes from immediate
  buf[0] = imm & 0xff;
  buf[1] = (imm >> 8) & 0xff;
  buf[2] = (imm >> 16) & 0xff;
  buf[3] = (imm >> 24) & 0xff;
  // Upper 4 bytes: sign-extend
  const fill = imm < 0 ? 0xff : 0x00;
  buf[4] = fill;
  buf[5] = fill;
  buf[6] = fill;
  buf[7] = fill;
  return ctx.mem.fastStore(address, buf);
}

// ============ ONE_REGISTER_ONE_IMMEDIATE: store direct (register → address) ============

function decode1r1i(code: Uint8Array, pc: number, skip: Uint8Array): [number, number, number] {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = readSignedImm(code, pc + 2, immLen);
  return [ra, imm, dist];
}

export function handleStoreU8(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, imm, dist] = decode1r1i(code, pc, skip);
  const address = imm >>> 0;
  const fault = storeRegBytes(ctx, address, ra, 1);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleStoreU16(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, imm, dist] = decode1r1i(code, pc, skip);
  const address = imm >>> 0;
  const fault = storeRegBytes(ctx, address, ra, 2);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleStoreU32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, imm, dist] = decode1r1i(code, pc, skip);
  const address = imm >>> 0;
  const fault = storeRegBytes(ctx, address, ra, 4);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleStoreU64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, imm, dist] = decode1r1i(code, pc, skip);
  const address = imm >>> 0;
  const fault = storeRegBytes(ctx, address, ra, 8);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

// ============ TWO_REGISTERS_ONE_IMMEDIATE: store indirect (register → reg + imm) ============

function decode2r1i(code: Uint8Array, pc: number, skip: Uint8Array): [number, number, number, number] {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = readSignedImm(code, pc + 2, immLen);
  return [ra, rb, imm, dist];
}

export function handleStoreIndU8(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  const address = ((ctx.regs.getU32(rb) >>> 0) + imm) >>> 0;
  const fault = storeRegBytes(ctx, address, ra, 1);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleStoreIndU16(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  const address = ((ctx.regs.getU32(rb) >>> 0) + imm) >>> 0;
  const fault = storeRegBytes(ctx, address, ra, 2);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleStoreIndU32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  const address = ((ctx.regs.getU32(rb) >>> 0) + imm) >>> 0;
  const fault = storeRegBytes(ctx, address, ra, 4);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleStoreIndU64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, imm, dist] = decode2r1i(code, pc, skip);
  const address = ((ctx.regs.getU32(rb) >>> 0) + imm) >>> 0;
  const fault = storeRegBytes(ctx, address, ra, 8);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

// ============ TWO_IMMEDIATES: store immediate to address ============

function decode2imm(code: Uint8Array, pc: number, skip: Uint8Array): [number, number, number] {
  const b = code[pc + 1];
  const firstImmLen = clampLen(b & 0xf);
  const dist = 1 + skip[pc + 1];
  const secondImmLen = Math.min(4, Math.max(0, dist - 2 - firstImmLen));
  const imm1 = readSignedImm(code, pc + 2, firstImmLen);
  const imm2 = readSignedImm(code, pc + 2 + firstImmLen, secondImmLen);
  return [imm1, imm2, dist];
}

export function handleStoreImmU8(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [address, value, dist] = decode2imm(code, pc, skip);
  const addr = address >>> 0;
  const fault = storeImmBytes(ctx, addr, value, 1);
  if (fault !== 0) {
    return handleFault(ctx, fault, addr);
  }
  return pc + dist;
}

export function handleStoreImmU16(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [address, value, dist] = decode2imm(code, pc, skip);
  const addr = address >>> 0;
  const fault = storeImmBytes(ctx, addr, value, 2);
  if (fault !== 0) {
    return handleFault(ctx, fault, addr);
  }
  return pc + dist;
}

export function handleStoreImmU32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [address, value, dist] = decode2imm(code, pc, skip);
  const addr = address >>> 0;
  const fault = storeImmBytes(ctx, addr, value, 4);
  if (fault !== 0) {
    return handleFault(ctx, fault, addr);
  }
  return pc + dist;
}

export function handleStoreImmU64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [address, value, dist] = decode2imm(code, pc, skip);
  const addr = address >>> 0;
  const fault = storeImmBytes64(ctx, addr, value);
  if (fault !== 0) {
    return handleFault(ctx, fault, addr);
  }
  return pc + dist;
}

// ============ ONE_REGISTER_TWO_IMMEDIATES: store immediate indirect (imm → reg + imm) ============

function decode1r2imm(code: Uint8Array, pc: number, skip: Uint8Array): [number, number, number, number] {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const firstImmLen = clampLen(b >> 4);
  const dist = 1 + skip[pc + 1];
  const secondImmLen = Math.min(4, Math.max(0, dist - 2 - firstImmLen));
  const imm1 = readSignedImm(code, pc + 2, firstImmLen);
  const imm2 = readSignedImm(code, pc + 2 + firstImmLen, secondImmLen);
  return [ra, imm1, imm2, dist];
}

export function handleStoreImmIndU8(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, imm1, imm2, dist] = decode1r2imm(code, pc, skip);
  const address = ((ctx.regs.getU32(ra) >>> 0) + imm1) >>> 0;
  const fault = storeImmBytes(ctx, address, imm2, 1);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleStoreImmIndU16(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, imm1, imm2, dist] = decode1r2imm(code, pc, skip);
  const address = ((ctx.regs.getU32(ra) >>> 0) + imm1) >>> 0;
  const fault = storeImmBytes(ctx, address, imm2, 2);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleStoreImmIndU32(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, imm1, imm2, dist] = decode1r2imm(code, pc, skip);
  const address = ((ctx.regs.getU32(ra) >>> 0) + imm1) >>> 0;
  const fault = storeImmBytes(ctx, address, imm2, 4);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}

export function handleStoreImmIndU64(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, imm1, imm2, dist] = decode1r2imm(code, pc, skip);
  const address = ((ctx.regs.getU32(ra) >>> 0) + imm1) >>> 0;
  const fault = storeImmBytes64(ctx, address, imm2);
  if (fault !== 0) {
    return handleFault(ctx, fault, address);
  }
  return pc + dist;
}
