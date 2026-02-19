import { clampReg, readSignedImm, readUnsignedImm32 } from "../helpers.js";
import type { InterpreterContext } from "../types.js";
import { EXIT_HALT, EXIT_PANIC } from "../types.js";

const EXIT_ADDRESS = 0xffff0000;
const JUMP_ALIGNMENT_FACTOR = 2;

// Helper: validate branch target is a basic block start
function branchTo(ctx: InterpreterContext, target: number): number {
  if (!ctx.blocks[target]) {
    return EXIT_PANIC;
  }
  return target;
}

// ============ TWO_REGISTERS_ONE_OFFSET: branch reg-reg ============

function decode2rOff(
  _ctx: InterpreterContext,
  code: Uint8Array,
  pc: number,
  skip: Uint8Array,
): [number, number, number, number] {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const rb = clampReg(b >> 4);
  const dist = 1 + skip[pc + 1];
  const offsetLen = Math.max(0, dist - 2);
  const target = pc + readSignedImm(code, pc + 2, offsetLen);
  return [ra, rb, target, dist];
}

export function handleBranchEq(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, target, dist] = decode2rOff(ctx, code, pc, skip);
  if (ctx.regs.getU64(ra) === ctx.regs.getU64(rb)) {
    return branchTo(ctx, target);
  }
  return pc + dist;
}

export function handleBranchNe(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, target, dist] = decode2rOff(ctx, code, pc, skip);
  if (ctx.regs.getU64(ra) !== ctx.regs.getU64(rb)) {
    return branchTo(ctx, target);
  }
  return pc + dist;
}

export function handleBranchLtU(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, target, dist] = decode2rOff(ctx, code, pc, skip);
  if (ctx.regs.getU64(ra) < ctx.regs.getU64(rb)) {
    return branchTo(ctx, target);
  }
  return pc + dist;
}

export function handleBranchLtS(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, target, dist] = decode2rOff(ctx, code, pc, skip);
  if (ctx.regs.getI64(ra) < ctx.regs.getI64(rb)) {
    return branchTo(ctx, target);
  }
  return pc + dist;
}

export function handleBranchGeU(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, target, dist] = decode2rOff(ctx, code, pc, skip);
  if (ctx.regs.getU64(ra) >= ctx.regs.getU64(rb)) {
    return branchTo(ctx, target);
  }
  return pc + dist;
}

export function handleBranchGeS(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, rb, target, dist] = decode2rOff(ctx, code, pc, skip);
  if (ctx.regs.getI64(ra) >= ctx.regs.getI64(rb)) {
    return branchTo(ctx, target);
  }
  return pc + dist;
}

// ============ ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET: branch reg-imm ============

function decode1r1i1o(code: Uint8Array, pc: number, skip: Uint8Array): [number, number, bigint, number, number] {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const immLenField = (b >> 4) & 0xf;
  const immediateLength = immLenField > 4 ? 4 : immLenField;
  const dist = 1 + skip[pc + 1];
  const offsetLength = Math.min(4, Math.max(0, dist - 2 - immediateLength));
  const imm = BigInt(readSignedImm(code, pc + 2, immediateLength));
  const target = pc + readSignedImm(code, pc + 2 + immediateLength, offsetLength);
  return [ra, dist, imm, target, dist];
}

export function handleBranchEqImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, , imm, target, dist] = decode1r1i1o(code, pc, skip);
  if (ctx.regs.getU64(ra) === BigInt.asUintN(64, imm)) {
    return branchTo(ctx, target);
  }
  return pc + dist;
}

export function handleBranchNeImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, , imm, target, dist] = decode1r1i1o(code, pc, skip);
  if (ctx.regs.getU64(ra) !== BigInt.asUintN(64, imm)) {
    return branchTo(ctx, target);
  }
  return pc + dist;
}

export function handleBranchLtUImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, , imm, target, dist] = decode1r1i1o(code, pc, skip);
  if (ctx.regs.getU64(ra) < BigInt.asUintN(64, imm)) {
    return branchTo(ctx, target);
  }
  return pc + dist;
}

export function handleBranchLeUImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, , imm, target, dist] = decode1r1i1o(code, pc, skip);
  if (ctx.regs.getU64(ra) <= BigInt.asUintN(64, imm)) {
    return branchTo(ctx, target);
  }
  return pc + dist;
}

export function handleBranchGeUImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, , imm, target, dist] = decode1r1i1o(code, pc, skip);
  if (ctx.regs.getU64(ra) >= BigInt.asUintN(64, imm)) {
    return branchTo(ctx, target);
  }
  return pc + dist;
}

export function handleBranchGtUImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, , imm, target, dist] = decode1r1i1o(code, pc, skip);
  if (ctx.regs.getU64(ra) > BigInt.asUintN(64, imm)) {
    return branchTo(ctx, target);
  }
  return pc + dist;
}

export function handleBranchLtSImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, , imm, target, dist] = decode1r1i1o(code, pc, skip);
  if (ctx.regs.getI64(ra) < BigInt.asIntN(64, imm)) {
    return branchTo(ctx, target);
  }
  return pc + dist;
}

export function handleBranchLeSImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, , imm, target, dist] = decode1r1i1o(code, pc, skip);
  if (ctx.regs.getI64(ra) <= BigInt.asIntN(64, imm)) {
    return branchTo(ctx, target);
  }
  return pc + dist;
}

export function handleBranchGeSImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, , imm, target, dist] = decode1r1i1o(code, pc, skip);
  if (ctx.regs.getI64(ra) >= BigInt.asIntN(64, imm)) {
    return branchTo(ctx, target);
  }
  return pc + dist;
}

export function handleBranchGtSImm(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, , imm, target, dist] = decode1r1i1o(code, pc, skip);
  if (ctx.regs.getI64(ra) > BigInt.asIntN(64, imm)) {
    return branchTo(ctx, target);
  }
  return pc + dist;
}

// ============ ONE_OFFSET: JUMP ============

export function handleJump(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const dist = 1 + skip[pc + 1];
  const offsetLen = Math.min(4, dist - 1);
  const target = pc + readSignedImm(code, pc + 1, offsetLen);
  return branchTo(ctx, target);
}

// ============ ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET: LOAD_IMM_JUMP ============

export function handleLoadImmJump(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const [ra, , imm, target] = decode1r1i1o(code, pc, skip);
  ctx.regs.setU32(ra, Number(imm));
  return branchTo(ctx, target);
}

// ============ Dynamic jumps ============

function djump(ctx: InterpreterContext, address: number): number {
  if (address === EXIT_ADDRESS) {
    return EXIT_HALT;
  }
  if (address === 0 || (address & 1) !== 0) {
    return EXIT_PANIC;
  }
  const index = address / JUMP_ALIGNMENT_FACTOR - 1;
  if (index < 0 || index >= ctx.jumpTableSize) {
    return EXIT_PANIC;
  }
  const dest = ctx.jumpTable[index];
  if (!ctx.blocks[dest]) {
    return EXIT_PANIC;
  }
  return dest;
}

/**
 * JUMP_IND - indirect jump.
 * Argument type: ONE_REGISTER_ONE_IMMEDIATE (registerIndex=low nibble, imm)
 */
export function handleJumpInd(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b = code[pc + 1];
  const ra = clampReg(b & 0xf);
  const dist = 1 + skip[pc + 1];
  const immLen = Math.max(0, dist - 2);
  const imm = readUnsignedImm32(code, pc + 2, immLen);
  const regVal = ctx.regs.getU32(ra) >>> 0;
  const address = (regVal + imm) >>> 0;
  return djump(ctx, address);
}

/**
 * LOAD_IMM_JUMP_IND - load immediate into register + indirect jump.
 * Argument type: TWO_REGISTERS_TWO_IMMEDIATES
 * ra=low(byte1), rb=high(byte1), immLen=low(byte2), imm1 from byte3+, imm2 after imm1
 */
export function handleLoadImmJumpInd(ctx: InterpreterContext, pc: number, code: Uint8Array, skip: Uint8Array): number {
  const b1 = code[pc + 1];
  const ra = clampReg(b1 & 0xf);
  const rb = clampReg(b1 >> 4);

  const b2 = code[pc + 2];
  const firstImmLen = (b2 & 0xf) > 4 ? 4 : b2 & 0xf;
  const dist = 1 + skip[pc + 1];

  const secondImmLen = Math.min(4, Math.max(0, dist - 3 - firstImmLen));

  const imm1 = readSignedImm(code, pc + 3, firstImmLen);
  const imm2 = readUnsignedImm32(code, pc + 3 + firstImmLen, secondImmLen);

  // Load first immediate into ra
  ctx.regs.setU32(ra, imm1);

  // Dynamic jump: rb register value + second immediate
  const regVal = ctx.regs.getU32(rb) >>> 0;
  const address = (regVal + imm2) >>> 0;
  return djump(ctx, address);
}
