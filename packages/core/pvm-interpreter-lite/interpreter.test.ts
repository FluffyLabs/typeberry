import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Status, tryAsGas } from "@typeberry/pvm-interface";
import { Instruction } from "@typeberry/pvm-interpreter/instruction.js";
import { Interpreter as OldInterpreter } from "@typeberry/pvm-interpreter/interpreter.js";
import { BigGasCounter, createGasCounter, FastGasCounter } from "./gas.js";
import { Interpreter as LiteInterpreter } from "./interpreter.js";

/**
 * Helper to build a raw PVM program blob from code bytes and mask.
 *
 * Format: [jumpTableLength(varU32)] [jumpTableItemLength(u8)] [codeLength(varU32)] [jumpTable] [code] [mask bits]
 *
 * mask: array of booleans, true = instruction start, false = argument byte
 * jumpTableEntries: array of numbers (destinations), each encoded as jumpTableItemLength bytes LE
 */
function buildProgram(
  codeBytes: number[],
  maskBits: boolean[],
  jumpTableEntries: number[] = [],
  jumpTableItemLength = 0,
): Uint8Array {
  const codeLen = codeBytes.length;
  assert.equal(maskBits.length, codeLen, "mask length must equal code length");

  // Encode mask as BitVec (LSB first within each byte)
  const maskByteLen = Math.ceil(codeLen / 8);
  const maskBytes: number[] = [];
  for (let byteIdx = 0; byteIdx < maskByteLen; byteIdx++) {
    let byte = 0;
    for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
      const pos = byteIdx * 8 + bitIdx;
      if (pos < codeLen && maskBits[pos]) {
        byte |= 1 << bitIdx;
      }
    }
    maskBytes.push(byte);
  }

  // Encode jump table
  const jtItemLen = jumpTableEntries.length > 0 ? jumpTableItemLength : 0;
  const jtData: number[] = [];
  for (const entry of jumpTableEntries) {
    for (let i = 0; i < jtItemLen; i++) {
      jtData.push((entry >> (i * 8)) & 0xff);
    }
  }

  // varU32 encoding for small values (< 128)
  function varU32(n: number): number[] {
    if (n < 128) {
      return [n];
    }
    if (n < 16384) {
      return [0x80 | (n >> 8), n & 0xff];
    }
    throw new Error(`varU32 encoding for ${n} not implemented in test helper`);
  }

  return new Uint8Array([
    ...varU32(jumpTableEntries.length),
    jtItemLen,
    ...varU32(codeLen),
    ...jtData,
    ...codeBytes,
    ...maskBytes,
  ]);
}

/**
 * Compare two interpreters after running the same program.
 * Both interpreters must produce the same:
 * - Status
 * - PC
 * - All 13 registers (as raw bytes)
 * - Exit param
 */
function compareInterpreters(
  label: string,
  program: Uint8Array,
  gas: number,
  setupRegisters?: (regs: Uint8Array) => void,
) {
  const oldInterpreter = new OldInterpreter();
  const liteInterpreter = new LiteInterpreter();

  oldInterpreter.resetGeneric(program, 0, tryAsGas(gas));
  liteInterpreter.resetGeneric(program, 0, tryAsGas(gas));

  if (setupRegisters !== undefined) {
    const regBytes = new Uint8Array(13 * 8);
    setupRegisters(regBytes);
    oldInterpreter.registers.setAllEncoded(regBytes);
    liteInterpreter.registers.setAllEncoded(regBytes);
  }

  oldInterpreter.runProgram();
  liteInterpreter.runProgram();

  const oldStatus = oldInterpreter.getStatus();
  const liteStatus = liteInterpreter.getStatus();
  assert.equal(
    liteStatus,
    oldStatus,
    `${label}: status mismatch (old=${Status[oldStatus]}, lite=${Status[liteStatus]})`,
  );

  const oldPC = oldInterpreter.getPC();
  const litePC = liteInterpreter.getPC();
  assert.equal(litePC, oldPC, `${label}: PC mismatch`);

  const oldRegs = oldInterpreter.registers.getAllEncoded();
  const liteRegs = liteInterpreter.registers.getAllEncoded();
  assert.deepEqual(liteRegs, oldRegs, `${label}: registers mismatch`);

  const oldParam = oldInterpreter.getExitParam();
  const liteParam = liteInterpreter.getExitParam();
  assert.equal(liteParam, oldParam, `${label}: exitParam mismatch`);
}

// ===== Program building helpers =====

/**
 * Set a bigint register value in a 104-byte register buffer.
 * Values are stored as 64-bit little-endian.
 */
function setReg(regs: Uint8Array, regIndex: number, value: bigint) {
  const dv = new DataView(regs.buffer);
  dv.setBigUint64(regIndex * 8, BigInt.asUintN(64, value), true);
}

/**
 * Build a program with a THREE_REGISTERS instruction followed by TRAP.
 * THREE_REGISTERS format: [opcode] [ra_lo | rb_hi] [rd_lo]
 * Where ra=low nibble byte1, rb=high nibble byte1, rd=low nibble byte2.
 */
function threeRegProgram(opcode: number, ra = 0, rb = 1, rd = 12): { code: number[]; mask: boolean[] } {
  const byte1 = ((rb & 0xf) << 4) | (ra & 0xf);
  const byte2 = rd & 0xf;
  return {
    code: [opcode, byte1, byte2, Instruction.TRAP],
    mask: [true, false, false, true],
  };
}

/**
 * Build a program with a TWO_REGISTERS instruction followed by TRAP.
 * TWO_REGISTERS format: [opcode] [first_hi | second_lo]
 * first=high nibble (source), second=low nibble (dest).
 */
function twoRegProgram(opcode: number, source = 0, dest = 12): { code: number[]; mask: boolean[] } {
  const byte1 = ((source & 0xf) << 4) | (dest & 0xf);
  return {
    code: [opcode, byte1, Instruction.TRAP],
    mask: [true, false, true],
  };
}

/**
 * Build a program with a TWO_REGISTERS_ONE_IMMEDIATE instruction followed by TRAP.
 * Format: [opcode] [ra_lo | rb_hi] [imm bytes...]
 * ra=low nibble (dest), rb=high nibble (source), imm from remaining bytes.
 */
function twoRegImmProgram(
  opcode: number,
  ra = 12,
  rb = 0,
  immBytes: number[] = [],
): { code: number[]; mask: boolean[] } {
  const byte1 = ((rb & 0xf) << 4) | (ra & 0xf);
  const code = [opcode, byte1, ...immBytes, Instruction.TRAP];
  const mask = [true, ...Array(1 + immBytes.length).fill(false), true];
  return { code, mask };
}

/** Encode a signed 32-bit value as LE bytes (1-4 bytes). */
function immLE(value: number | bigint, bytes = 4): number[] {
  const result: number[] = [];
  let v = typeof value === "bigint" ? Number(BigInt.asUintN(32, value)) : value;
  for (let i = 0; i < bytes; i++) {
    result.push(v & 0xff);
    v = v >> 8;
  }
  return result;
}

/**
 * Test a THREE_REGISTERS instruction: set reg[ra]=firstVal, reg[rb]=secondVal,
 * execute instruction, compare with old interpreter.
 */
function testThreeReg(label: string, opcode: number, firstVal: bigint, secondVal: bigint) {
  const { code, mask } = threeRegProgram(opcode);
  const program = buildProgram(code, mask);
  compareInterpreters(label, program, 100, (regs) => {
    setReg(regs, 0, firstVal);
    setReg(regs, 1, secondVal);
  });
}

/**
 * Test a TWO_REGISTERS instruction: set reg[source]=val, execute, compare.
 */
function testTwoReg(label: string, opcode: number, sourceVal: bigint) {
  const { code, mask } = twoRegProgram(opcode);
  const program = buildProgram(code, mask);
  compareInterpreters(label, program, 100, (regs) => {
    setReg(regs, 0, sourceVal);
  });
}

// ============ Tests ============

describe("pvm-interpreter-lite vs pvm-interpreter", () => {
  // ===== BASIC INSTRUCTIONS =====

  describe("basic instructions", () => {
    it("TRAP (opcode 0) -> PANIC", () => {
      const program = buildProgram([Instruction.TRAP], [true]);
      compareInterpreters("TRAP", program, 100);
    });

    it("FALLTHROUGH -> next instruction -> TRAP", () => {
      const program = buildProgram([Instruction.FALLTHROUGH, Instruction.TRAP], [true, true]);
      compareInterpreters("FALLTHROUGH", program, 100);
    });

    it("unknown opcode -> PANIC", () => {
      const program = buildProgram([5], [true]);
      compareInterpreters("unknown opcode", program, 100);
    });

    it("OOG - out of gas", () => {
      const program = buildProgram(
        [Instruction.FALLTHROUGH, Instruction.FALLTHROUGH, Instruction.TRAP],
        [true, true, true],
      );
      compareInterpreters("OOG", program, 1);
    });

    it("PC past end of code -> TRAP -> PANIC", () => {
      const program = buildProgram([Instruction.FALLTHROUGH], [true]);
      compareInterpreters("PC past end", program, 100);
    });
  });

  // ===== ARITHMETIC 32-BIT (adapted from math-ops.test.ts) =====

  describe("arithmetic 32-bit", () => {
    it("ADD_32: 12 + 13 = 25", () => testThreeReg("ADD_32", Instruction.ADD_32, 12n, 13n));
    it("ADD_32: overflow (2^32-1 + 13 = 12)", () =>
      testThreeReg("ADD_32 overflow", Instruction.ADD_32, 2n ** 32n - 1n, 13n));

    it("SUB_32: 13 - 12 = 1", () => testThreeReg("SUB_32", Instruction.SUB_32, 13n, 12n));
    it("SUB_32: underflow (12 - 13 wraps)", () => testThreeReg("SUB_32 underflow", Instruction.SUB_32, 12n, 13n));

    it("MUL_32: 12 * 13 = 156", () => testThreeReg("MUL_32", Instruction.MUL_32, 12n, 13n));
    it("MUL_32: overflow (2^17+1 * 2^18)", () =>
      testThreeReg("MUL_32 overflow", Instruction.MUL_32, 2n ** 17n + 1n, 2n ** 18n));
  });

  // ===== ARITHMETIC 64-BIT (adapted from math-ops.test.ts) =====

  describe("arithmetic 64-bit", () => {
    it("ADD_64: 12 + 13 = 25", () => testThreeReg("ADD_64", Instruction.ADD_64, 12n, 13n));
    it("ADD_64: large values", () => testThreeReg("ADD_64 large", Instruction.ADD_64, 0x100000000n, 0x200000000n));

    it("SUB_64: 13 - 12 = 1", () => testThreeReg("SUB_64", Instruction.SUB_64, 13n, 12n));
    it("SUB_64: underflow (12 - 13 wraps)", () => testThreeReg("SUB_64 underflow", Instruction.SUB_64, 12n, 13n));

    it("MUL_64: 12 * 13 = 156", () => testThreeReg("MUL_64", Instruction.MUL_64, 12n, 13n));
    it("MUL_64: 0xFFFFFFFF * 0xFFFFFFFF", () =>
      testThreeReg("MUL_64 large", Instruction.MUL_64, 0xffffffffn, 0xffffffffn));
    it("MUL_64: overflow (2^57+1 * 2^58)", () =>
      testThreeReg("MUL_64 overflow", Instruction.MUL_64, 2n ** 57n + 1n, 2n ** 58n));
  });

  // ===== MUL UPPER (adapted from math-ops.test.ts) =====

  describe("mul upper", () => {
    it("MUL_UPPER_U_U: 2^60 * 2^60", () =>
      testThreeReg("MUL_UPPER_UU", Instruction.MUL_UPPER_U_U, 2n ** 60n, 2n ** 60n));
    it("MUL_UPPER_U_U: max unsigned", () =>
      testThreeReg("MUL_UPPER_UU max", Instruction.MUL_UPPER_U_U, 2n ** 64n - 1n, 2n ** 64n - 1n));

    it("MUL_UPPER_S_S: positive", () =>
      testThreeReg("MUL_UPPER_SS pos", Instruction.MUL_UPPER_S_S, 2n ** 60n, 2n ** 60n));
    it("MUL_UPPER_S_S: negative", () =>
      testThreeReg("MUL_UPPER_SS neg", Instruction.MUL_UPPER_S_S, -(2n ** 60n), -(2n ** 60n)));
    it("MUL_UPPER_S_S: pos * neg", () =>
      testThreeReg("MUL_UPPER_SS mixed", Instruction.MUL_UPPER_S_S, 2n ** 60n, -(2n ** 60n)));
    it("MUL_UPPER_S_S: neg * pos", () =>
      testThreeReg("MUL_UPPER_SS mixed2", Instruction.MUL_UPPER_S_S, -(2n ** 60n), 2n ** 30n));

    it("MUL_UPPER_S_U: positive", () =>
      testThreeReg("MUL_UPPER_SU pos", Instruction.MUL_UPPER_S_U, 2n ** 60n, 2n ** 60n));
    it("MUL_UPPER_S_U: neg * pos", () =>
      testThreeReg("MUL_UPPER_SU neg-pos", Instruction.MUL_UPPER_S_U, -(2n ** 60n), 2n ** 60n));
    it("MUL_UPPER_S_U: test vector case", () =>
      testThreeReg("MUL_UPPER_SU tv", Instruction.MUL_UPPER_S_U, 0xffffffff80000000n, 0xffffffffffff8000n));
  });

  // ===== DIVISION AND REMAINDER 32-BIT (adapted from math-ops.test.ts) =====

  describe("division 32-bit", () => {
    it("DIV_U_32: 26 / 2 = 13", () => testThreeReg("DIV_U_32", Instruction.DIV_U_32, 26n, 2n));
    it("DIV_U_32: rounding (25 / 2 = 12)", () => testThreeReg("DIV_U_32 round", Instruction.DIV_U_32, 25n, 2n));
    it("DIV_U_32: by zero -> all 1s", () => testThreeReg("DIV_U_32 zero", Instruction.DIV_U_32, 25n, 0n));

    it("DIV_S_32: positive (26 / 2 = 13)", () => testThreeReg("DIV_S_32 pos", Instruction.DIV_S_32, 26n, 2n));
    it("DIV_S_32: negative (-26 / -2 = 13)", () => testThreeReg("DIV_S_32 neg", Instruction.DIV_S_32, -26n, -2n));
    it("DIV_S_32: pos / neg (-26 / 2 = -13)", () => testThreeReg("DIV_S_32 posneg", Instruction.DIV_S_32, -26n, 2n));
    it("DIV_S_32: neg / pos (26 / -2 = -13)", () => testThreeReg("DIV_S_32 negpos", Instruction.DIV_S_32, 26n, -2n));
    it("DIV_S_32: rounding positive (25 / 2 = 12)", () =>
      testThreeReg("DIV_S_32 round pos", Instruction.DIV_S_32, 25n, 2n));
    it("DIV_S_32: rounding negative (-25 / 2 = -12)", () =>
      testThreeReg("DIV_S_32 round neg", Instruction.DIV_S_32, -25n, 2n));
    it("DIV_S_32: by zero -> -1", () => testThreeReg("DIV_S_32 zero", Instruction.DIV_S_32, 25n, 0n));
    it("DIV_S_32: overflow MIN_I32 / -1", () =>
      testThreeReg("DIV_S_32 overflow", Instruction.DIV_S_32, -(2n ** 31n), -1n));

    it("REM_U_32: 26 % 5 = 1", () => testThreeReg("REM_U_32", Instruction.REM_U_32, 26n, 5n));
    it("REM_U_32: by zero -> dividend", () => testThreeReg("REM_U_32 zero", Instruction.REM_U_32, 25n, 0n));

    it("REM_S_32: 26 % 5 = 1", () => testThreeReg("REM_S_32", Instruction.REM_S_32, 26n, 5n));
  });

  // ===== DIVISION AND REMAINDER 64-BIT =====

  describe("division 64-bit", () => {
    it("DIV_U_64: 26 / 2 = 13", () => testThreeReg("DIV_U_64", Instruction.DIV_U_64, 26n, 2n));
    it("DIV_U_64: rounding (25 / 2 = 12)", () => testThreeReg("DIV_U_64 round", Instruction.DIV_U_64, 25n, 2n));
    it("DIV_U_64: by zero -> all 1s", () => testThreeReg("DIV_U_64 zero", Instruction.DIV_U_64, 25n, 0n));

    it("DIV_S_64: positive (26 / 2 = 13)", () => testThreeReg("DIV_S_64 pos", Instruction.DIV_S_64, 26n, 2n));
    it("DIV_S_64: negative (-26 / -2 = 13)", () => testThreeReg("DIV_S_64 neg", Instruction.DIV_S_64, -26n, -2n));
    it("DIV_S_64: mixed (-26 / 2 = -13)", () => testThreeReg("DIV_S_64 mixed", Instruction.DIV_S_64, -26n, 2n));
    it("DIV_S_64: mixed2 (26 / -2 = -13)", () => testThreeReg("DIV_S_64 mixed2", Instruction.DIV_S_64, 26n, -2n));
    it("DIV_S_64: rounding (25 / 2 = 12)", () => testThreeReg("DIV_S_64 round", Instruction.DIV_S_64, 25n, 2n));
    it("DIV_S_64: rounding neg (-25 / 2 = -12)", () =>
      testThreeReg("DIV_S_64 round neg", Instruction.DIV_S_64, -25n, 2n));
    it("DIV_S_64: by zero -> -1", () => testThreeReg("DIV_S_64 zero", Instruction.DIV_S_64, 25n, 0n));
    it("DIV_S_64: overflow MIN_I64 / -1", () =>
      testThreeReg("DIV_S_64 overflow", Instruction.DIV_S_64, -(2n ** 63n), -1n));

    it("REM_U_64: 26 % 5 = 1", () => testThreeReg("REM_U_64", Instruction.REM_U_64, 26n, 5n));
    it("REM_U_64: by zero -> dividend", () => testThreeReg("REM_U_64 zero", Instruction.REM_U_64, 25n, 0n));

    it("REM_S_64: 26 % 5 = 1", () => testThreeReg("REM_S_64", Instruction.REM_S_64, 26n, 5n));
  });

  // ===== MIN / MAX (adapted from math-ops.test.ts) =====

  describe("min/max", () => {
    it("MIN: positive (1 vs 25)", () => testThreeReg("MIN pos", Instruction.MIN, 1n, 25n));
    it("MIN: negative (-1 vs -25)", () => testThreeReg("MIN neg", Instruction.MIN, -1n, -25n));
    it("MIN_U: positive (1 vs 25)", () => testThreeReg("MIN_U pos", Instruction.MIN_U, 1n, 25n));
    it("MIN_U: neg as unsigned (0 vs -25)", () => testThreeReg("MIN_U neg", Instruction.MIN_U, 0n, -25n));
    it("MAX: positive (1 vs 25)", () => testThreeReg("MAX pos", Instruction.MAX, 1n, 25n));
    it("MAX: negative (-1 vs -25)", () => testThreeReg("MAX neg", Instruction.MAX, -1n, -25n));
    it("MAX_U: positive (1 vs 25)", () => testThreeReg("MAX_U pos", Instruction.MAX_U, 1n, 25n));
    it("MAX_U: neg as unsigned (0 vs -25)", () => testThreeReg("MAX_U neg", Instruction.MAX_U, 0n, -25n));
  });

  // ===== BITWISE (adapted from bit-ops.test.ts) =====

  describe("bitwise operations", () => {
    it("AND: 0xff00ff00 & 0x0ff00ff0", () => testThreeReg("AND", Instruction.AND, 0xff00ff00n, 0x0ff00ff0n));
    it("OR: 0xff00 | 0x00ff", () => testThreeReg("OR", Instruction.OR, 0xff00n, 0x00ffn));
    it("XOR: 0xaaaa ^ 0x5555", () => testThreeReg("XOR", Instruction.XOR, 0xaaaan, 0x5555n));
    it("AND_INV: 0b011 & ~0b101 = 0b010", () => testThreeReg("AND_INV", Instruction.AND_INV, 0b011n, 0b101n));
    it("OR_INV: ~0b10 | 0b01", () => testThreeReg("OR_INV", Instruction.OR_INV, 0b10n, 0b01n));
    it("XNOR: ~(0b101 ^ 0b110)", () => testThreeReg("XNOR", Instruction.XNOR, 0b101n, 0b110n));
    it("OR: 0b01 | 0b10", () => testThreeReg("OR simple", Instruction.OR, 0b01n, 0b10n));
    it("AND: 0b101 & 0b011", () => testThreeReg("AND simple", Instruction.AND, 0b101n, 0b011n));
    it("XOR: 0b101 ^ 0b110", () => testThreeReg("XOR simple", Instruction.XOR, 0b101n, 0b110n));
  });

  // ===== BIT MANIPULATION (TWO_REGISTERS) (adapted from bit-ops.test.ts) =====

  describe("bit manipulation", () => {
    it("COUNT_SET_BITS_32: 0b101 -> 2", () => testTwoReg("CSB32", Instruction.COUNT_SET_BITS_32, 0b101n));
    it("COUNT_SET_BITS_32: 0 -> 0", () => testTwoReg("CSB32 min", Instruction.COUNT_SET_BITS_32, 0n));
    it("COUNT_SET_BITS_32: max u64 -> 32", () =>
      testTwoReg("CSB32 max", Instruction.COUNT_SET_BITS_32, 2n ** 64n - 1n));

    it("COUNT_SET_BITS_64: 0b101 -> 2", () => testTwoReg("CSB64", Instruction.COUNT_SET_BITS_64, 0b101n));
    it("COUNT_SET_BITS_64: 0 -> 0", () => testTwoReg("CSB64 min", Instruction.COUNT_SET_BITS_64, 0n));
    it("COUNT_SET_BITS_64: max u64 -> 64", () =>
      testTwoReg("CSB64 max", Instruction.COUNT_SET_BITS_64, 2n ** 64n - 1n));

    it("LEADING_ZERO_BITS_64: 0b101 -> 61", () => testTwoReg("CLZ64", Instruction.LEADING_ZERO_BITS_64, 0b101n));
    it("LEADING_ZERO_BITS_64: 0 -> 64", () => testTwoReg("CLZ64 min", Instruction.LEADING_ZERO_BITS_64, 0n));
    it("LEADING_ZERO_BITS_64: max -> 0", () =>
      testTwoReg("CLZ64 max", Instruction.LEADING_ZERO_BITS_64, 2n ** 64n - 1n));

    it("LEADING_ZERO_BITS_32: 0b101 -> 29", () => testTwoReg("CLZ32", Instruction.LEADING_ZERO_BITS_32, 0b101n));
    it("LEADING_ZERO_BITS_32: 0 -> 32", () => testTwoReg("CLZ32 min", Instruction.LEADING_ZERO_BITS_32, 0n));
    it("LEADING_ZERO_BITS_32: max -> 0", () =>
      testTwoReg("CLZ32 max", Instruction.LEADING_ZERO_BITS_32, 2n ** 64n - 1n));

    it("TRAILING_ZERO_BITS_64: 0b1010 -> 1", () => testTwoReg("CTZ64", Instruction.TRAILING_ZERO_BITS_64, 0b1010n));
    it("TRAILING_ZERO_BITS_64: 0 -> 64", () => testTwoReg("CTZ64 min", Instruction.TRAILING_ZERO_BITS_64, 0n));
    it("TRAILING_ZERO_BITS_64: max -> 0", () =>
      testTwoReg("CTZ64 max", Instruction.TRAILING_ZERO_BITS_64, 2n ** 64n - 1n));

    it("TRAILING_ZERO_BITS_32: 0b1010 -> 1", () => testTwoReg("CTZ32", Instruction.TRAILING_ZERO_BITS_32, 0b1010n));
    it("TRAILING_ZERO_BITS_32: 0 -> 32", () => testTwoReg("CTZ32 min", Instruction.TRAILING_ZERO_BITS_32, 0n));
    it("TRAILING_ZERO_BITS_32: max -> 0", () =>
      testTwoReg("CTZ32 max", Instruction.TRAILING_ZERO_BITS_32, 2n ** 64n - 1n));

    it("SIGN_EXTEND_8: 0x80 -> -128", () => testTwoReg("SE8 neg", Instruction.SIGN_EXTEND_8, 0x80n));
    it("SIGN_EXTEND_8: 0x70 -> 0x70", () => testTwoReg("SE8 pos", Instruction.SIGN_EXTEND_8, 0x70n));
    it("SIGN_EXTEND_8: preserves lower 8 bits", () =>
      testTwoReg("SE8 complex", Instruction.SIGN_EXTEND_8, 0x00006d6d6d6dd48dn));

    it("SIGN_EXTEND_16: 0x8000 -> -32768", () => testTwoReg("SE16 neg", Instruction.SIGN_EXTEND_16, 0x8000n));
    it("SIGN_EXTEND_16: 0x7000 -> 0x7000", () => testTwoReg("SE16 pos", Instruction.SIGN_EXTEND_16, 0x7000n));
    it("SIGN_EXTEND_16: preserves lower 16 bits", () =>
      testTwoReg("SE16 complex", Instruction.SIGN_EXTEND_16, 0x00006d6d6d6dd46dn));

    it("ZERO_EXTEND_16: max -> 0xffff", () => testTwoReg("ZE16", Instruction.ZERO_EXTEND_16, 2n ** 64n - 1n));

    it("REVERSE_BYTES: positive", () => testTwoReg("RB pos", Instruction.REVERSE_BYTES, 0x123456789abcdef0n));
    it("REVERSE_BYTES: negative", () => testTwoReg("RB neg", Instruction.REVERSE_BYTES, -0x123456789abcdef0n));
  });

  // ===== SHIFTS (adapted from shift-ops.test.ts) =====

  describe("shifts 32-bit", () => {
    it("SHLO_L_32: 1 << 3 = 8", () => testThreeReg("SLL32", Instruction.SHLO_L_32, 0b0001n, 3n));
    it("SHLO_L_32: arg overflow (1 << 35 -> wraps to 1<<3)", () =>
      testThreeReg("SLL32 overflow", Instruction.SHLO_L_32, 0b0001n, 35n));
    it("SHLO_L_32: result overflow", () => testThreeReg("SLL32 res overflow", Instruction.SHLO_L_32, 0xa0000000n, 3n));

    it("SHLO_R_32: 16 >>> 3 = 2", () => testThreeReg("SRL32", Instruction.SHLO_R_32, 0b10000n, 3n));
    it("SHLO_R_32: arg overflow (16 >>> 35 -> wraps)", () =>
      testThreeReg("SRL32 overflow", Instruction.SHLO_R_32, 0b10000n, 35n));

    it("SHAR_R_32: positive (16 >> 3 = 2)", () => testThreeReg("SAR32 pos", Instruction.SHAR_R_32, 0b10000n, 3n));
    it("SHAR_R_32: negative (-8 >> 3 = -1)", () => testThreeReg("SAR32 neg", Instruction.SHAR_R_32, -8n, 3n));
    it("SHAR_R_32: arg overflow", () => testThreeReg("SAR32 overflow", Instruction.SHAR_R_32, 0b10000n, 35n));
  });

  describe("shifts 64-bit", () => {
    it("SHLO_L_64: 1 << 3 = 8", () => testThreeReg("SLL64", Instruction.SHLO_L_64, 0b0001n, 3n));
    it("SHLO_L_64: arg overflow (1 << 67 -> wraps)", () =>
      testThreeReg("SLL64 overflow", Instruction.SHLO_L_64, 0b0001n, 67n));
    it("SHLO_L_64: result overflow", () => testThreeReg("SLL64 res overflow", Instruction.SHLO_L_64, 0xa0000000n, 35n));

    it("SHLO_R_64: 16 >>> 3 = 2", () => testThreeReg("SRL64", Instruction.SHLO_R_64, 0b10000n, 3n));
    it("SHLO_R_64: arg overflow", () => testThreeReg("SRL64 overflow", Instruction.SHLO_R_64, 0b10000n, 67n));

    it("SHAR_R_64: positive (16 >> 3 = 2)", () => testThreeReg("SAR64 pos", Instruction.SHAR_R_64, 0b10000n, 3n));
    it("SHAR_R_64: negative (-8 >> 3 = -1)", () => testThreeReg("SAR64 neg", Instruction.SHAR_R_64, -8n, 3n));
    it("SHAR_R_64: arg overflow", () => testThreeReg("SAR64 overflow", Instruction.SHAR_R_64, 0b10000n, 67n));
  });

  // ===== SHIFT IMMEDIATE (TWO_REGISTERS_ONE_IMMEDIATE) =====

  describe("shift immediate 32-bit", () => {
    it("SHLO_L_IMM_32: 1 << 3 = 8", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHLO_L_IMM_32, 12, 0, immLE(3, 4));
      compareInterpreters("SLL_IMM32", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0b0001n));
    });
    it("SHLO_L_IMM_32: arg overflow (35 -> wraps to 3)", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHLO_L_IMM_32, 12, 0, immLE(35, 4));
      compareInterpreters("SLL_IMM32 ov", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0b0001n));
    });
    it("SHLO_R_IMM_32: 16 >>> 3 = 2", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHLO_R_IMM_32, 12, 0, immLE(3, 4));
      compareInterpreters("SRL_IMM32", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0b10000n));
    });
    it("SHAR_R_IMM_32: -8 >> 3 = -1", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHAR_R_IMM_32, 12, 0, immLE(3, 4));
      compareInterpreters("SAR_IMM32", buildProgram(code, mask), 100, (r) => setReg(r, 0, -8n));
    });
  });

  describe("shift immediate alt 32-bit", () => {
    it("SHLO_L_IMM_ALT_32: imm=0b0001, reg=3 -> 8", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHLO_L_IMM_ALT_32, 12, 0, immLE(0b0001, 4));
      compareInterpreters("SLL_ALT32", buildProgram(code, mask), 100, (r) => setReg(r, 0, 3n));
    });
    it("SHLO_R_IMM_ALT_32: imm=0b10000, reg=3 -> 2", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHLO_R_IMM_ALT_32, 12, 0, immLE(0b10000, 4));
      compareInterpreters("SRL_ALT32", buildProgram(code, mask), 100, (r) => setReg(r, 0, 3n));
    });
    it("SHAR_R_IMM_ALT_32: imm=-8, reg=3 -> -1", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHAR_R_IMM_ALT_32, 12, 0, immLE(-8, 4));
      compareInterpreters("SAR_ALT32", buildProgram(code, mask), 100, (r) => setReg(r, 0, 3n));
    });
  });

  describe("shift immediate 64-bit", () => {
    it("SHLO_L_IMM_64: 1 << 3 = 8", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHLO_L_IMM_64, 12, 0, immLE(3, 4));
      compareInterpreters("SLL_IMM64", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0b0001n));
    });
    it("SHLO_R_IMM_64: 16 >>> 3 = 2", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHLO_R_IMM_64, 12, 0, immLE(3, 4));
      compareInterpreters("SRL_IMM64", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0b10000n));
    });
    it("SHAR_R_IMM_64: -8 >> 3 = -1", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHAR_R_IMM_64, 12, 0, immLE(3, 4));
      compareInterpreters("SAR_IMM64", buildProgram(code, mask), 100, (r) => setReg(r, 0, -8n));
    });
  });

  // ===== ROTATIONS (adapted from bit-rotation-ops.test.ts) =====

  describe("rotations", () => {
    it("ROT_L_64: positive 28-bit rotate", () =>
      testThreeReg("RL64 pos", Instruction.ROT_L_64, 0x123456789abcdef0n, 28n));
    it("ROT_L_64: negative", () => testThreeReg("RL64 neg", Instruction.ROT_L_64, -0x123456789abcdef0n, 28n));
    it("ROT_L_64: no rotation", () => testThreeReg("RL64 zero", Instruction.ROT_L_64, 0x123456789abcdef0n, 0n));
    it("ROT_L_64: full rotation (64)", () => testThreeReg("RL64 full", Instruction.ROT_L_64, 0x123456789abcdef0n, 64n));
    it("ROT_L_64: overflow (128)", () =>
      testThreeReg("RL64 overflow", Instruction.ROT_L_64, 0x123456789abcdef0n, 128n));

    it("ROT_L_32: positive 12-bit rotate", () => testThreeReg("RL32 pos", Instruction.ROT_L_32, 0x12345678n, 12n));
    it("ROT_L_32: max value max shift", () => testThreeReg("RL32 maxmax", Instruction.ROT_L_32, 0x7ffffffen, 31n));
    it("ROT_L_32: negative", () => testThreeReg("RL32 neg", Instruction.ROT_L_32, -0x12345678n, 16n));
    it("ROT_L_32: no rotation (64-bit input)", () =>
      testThreeReg("RL32 zero", Instruction.ROT_L_32, 0x123456789abcdef0n, 0n));
    it("ROT_L_32: full rotation", () => testThreeReg("RL32 full", Instruction.ROT_L_32, 0x123456789abcdef0n, 32n));
    it("ROT_L_32: overflow (128)", () =>
      testThreeReg("RL32 overflow", Instruction.ROT_L_32, 0x123456789abcdef0n, 128n));

    it("ROT_R_64: positive 28-bit rotate", () =>
      testThreeReg("RR64 pos", Instruction.ROT_R_64, 0x123456789abcdef0n, 28n));
    it("ROT_R_64: negative", () => testThreeReg("RR64 neg", Instruction.ROT_R_64, -0x123456789abcdef0n, 28n));
    it("ROT_R_64: no rotation", () => testThreeReg("RR64 zero", Instruction.ROT_R_64, 0x123456789abcdef0n, 0n));
    it("ROT_R_64: full rotation", () => testThreeReg("RR64 full", Instruction.ROT_R_64, 0x123456789abcdef0n, 64n));
    it("ROT_R_64: overflow (128)", () =>
      testThreeReg("RR64 overflow", Instruction.ROT_R_64, 0x123456789abcdef0n, 128n));

    it("ROT_R_32: positive 12-bit rotate", () => testThreeReg("RR32 pos", Instruction.ROT_R_32, 0x12345678n, 12n));
    it("ROT_R_32: max value max shift", () => testThreeReg("RR32 maxmax", Instruction.ROT_R_32, 0x7ffffffen, 31n));
    it("ROT_R_32: negative", () => testThreeReg("RR32 neg", Instruction.ROT_R_32, -0x12345678n, 16n));
    it("ROT_R_32: no rotation", () => testThreeReg("RR32 zero", Instruction.ROT_R_32, 0x123456789abcdef0n, 0n));
    it("ROT_R_32: full rotation", () => testThreeReg("RR32 full", Instruction.ROT_R_32, 0x123456789abcdef0n, 32n));
    it("ROT_R_32: overflow", () => testThreeReg("RR32 overflow", Instruction.ROT_R_32, 0x123456789abcdef0n, 128n));
  });

  describe("rotation immediate", () => {
    it("ROT_R_64_IMM: positive 28-bit rotate", () => {
      const { code, mask } = twoRegImmProgram(Instruction.ROT_R_64_IMM, 12, 0, immLE(28, 4));
      compareInterpreters("RR64_IMM", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0x123456789abcdef0n));
    });
    it("ROT_R_64_IMM: no rotation", () => {
      const { code, mask } = twoRegImmProgram(Instruction.ROT_R_64_IMM, 12, 0, immLE(0, 4));
      compareInterpreters("RR64_IMM zero", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0x123456789abcdef0n));
    });
    it("ROT_R_32_IMM: 12-bit rotate", () => {
      const { code, mask } = twoRegImmProgram(Instruction.ROT_R_32_IMM, 12, 0, immLE(12, 4));
      compareInterpreters("RR32_IMM", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0x12345678n));
    });
    it("ROT_R_64_IMM_ALT: alt operand order", () => {
      const { code, mask } = twoRegImmProgram(Instruction.ROT_R_64_IMM_ALT, 12, 0, immLE(0x12345678, 4));
      compareInterpreters("RR64_ALT", buildProgram(code, mask), 100, (r) => setReg(r, 0, 28n));
    });
    it("ROT_R_32_IMM_ALT: alt operand order", () => {
      const { code, mask } = twoRegImmProgram(Instruction.ROT_R_32_IMM_ALT, 12, 0, immLE(0x12345678, 4));
      compareInterpreters("RR32_ALT", buildProgram(code, mask), 100, (r) => setReg(r, 0, 12n));
    });
  });

  // ===== BOOLEAN / SET_LT / SET_GT (adapted from boolean-ops.test.ts) =====

  describe("set_lt / set_gt", () => {
    it("SET_LT_U: 1 < 2 -> 1", () => testThreeReg("SLT_U true", Instruction.SET_LT_U, 1n, 2n));
    it("SET_LT_U: 3 < 2 -> 0", () => testThreeReg("SLT_U false", Instruction.SET_LT_U, 3n, 2n));
    it("SET_LT_S: -3 < -2 -> 1", () => testThreeReg("SLT_S true", Instruction.SET_LT_S, -3n, -2n));
    it("SET_LT_S: -1 < -2 -> 0", () => testThreeReg("SLT_S false", Instruction.SET_LT_S, -1n, -2n));
  });

  describe("set_lt/gt immediate", () => {
    it("SET_LT_U_IMM: 1 < 2 -> 1", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SET_LT_U_IMM, 12, 0, immLE(2, 4));
      compareInterpreters("SLT_U_IMM true", buildProgram(code, mask), 100, (r) => setReg(r, 0, 1n));
    });
    it("SET_LT_U_IMM: 3 < 2 -> 0", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SET_LT_U_IMM, 12, 0, immLE(2, 4));
      compareInterpreters("SLT_U_IMM false", buildProgram(code, mask), 100, (r) => setReg(r, 0, 3n));
    });
    it("SET_GT_U_IMM: 3 > 2 -> 1", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SET_GT_U_IMM, 12, 0, immLE(2, 4));
      compareInterpreters("SGT_U_IMM true", buildProgram(code, mask), 100, (r) => setReg(r, 0, 3n));
    });
    it("SET_GT_U_IMM: 1 > 2 -> 0", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SET_GT_U_IMM, 12, 0, immLE(2, 4));
      compareInterpreters("SGT_U_IMM false", buildProgram(code, mask), 100, (r) => setReg(r, 0, 1n));
    });
    it("SET_LT_S_IMM: -3 < -2 -> 1", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SET_LT_S_IMM, 12, 0, immLE(-2, 4));
      compareInterpreters("SLT_S_IMM true", buildProgram(code, mask), 100, (r) => setReg(r, 0, -3n));
    });
    it("SET_LT_S_IMM: -1 < -2 -> 0", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SET_LT_S_IMM, 12, 0, immLE(-2, 4));
      compareInterpreters("SLT_S_IMM false", buildProgram(code, mask), 100, (r) => setReg(r, 0, -1n));
    });
    it("SET_GT_S_IMM: -1 > -2 -> 1", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SET_GT_S_IMM, 12, 0, immLE(-2, 4));
      compareInterpreters("SGT_S_IMM true", buildProgram(code, mask), 100, (r) => setReg(r, 0, -1n));
    });
    it("SET_GT_S_IMM: -3 > -2 -> 0", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SET_GT_S_IMM, 12, 0, immLE(-2, 4));
      compareInterpreters("SGT_S_IMM false", buildProgram(code, mask), 100, (r) => setReg(r, 0, -3n));
    });
  });

  // ===== MOVE OPERATIONS (adapted from move-ops.test.ts) =====

  describe("move operations", () => {
    it("MOVE_REG: copy 5", () => {
      const { code, mask } = twoRegProgram(Instruction.MOVE_REG, 0, 12);
      compareInterpreters("MOVE", buildProgram(code, mask), 100, (r) => setReg(r, 0, 5n));
    });
    it("MOVE_REG: copy large u64", () => {
      const { code, mask } = twoRegProgram(Instruction.MOVE_REG, 0, 12);
      compareInterpreters("MOVE u64", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0x7fffffffffffffffn));
    });
  });

  describe("conditional moves", () => {
    it("CMOV_IZ: move if zero (satisfied)", () => {
      const { code, mask } = threeRegProgram(Instruction.CMOV_IZ, 0, 1, 12);
      compareInterpreters("CMOV_IZ sat", buildProgram(code, mask), 100, (r) => {
        setReg(r, 0, 99n);
        setReg(r, 1, 0n);
      });
    });
    it("CMOV_IZ: move if zero (not satisfied)", () => {
      const { code, mask } = threeRegProgram(Instruction.CMOV_IZ, 0, 1, 12);
      compareInterpreters("CMOV_IZ nsat", buildProgram(code, mask), 100, (r) => {
        setReg(r, 0, 99n);
        setReg(r, 1, 1n);
      });
    });
    it("CMOV_NZ: move if non-zero (satisfied)", () => {
      const { code, mask } = threeRegProgram(Instruction.CMOV_NZ, 0, 1, 12);
      compareInterpreters("CMOV_NZ sat", buildProgram(code, mask), 100, (r) => {
        setReg(r, 0, 99n);
        setReg(r, 1, 3n);
      });
    });
    it("CMOV_NZ: move if non-zero (not satisfied)", () => {
      const { code, mask } = threeRegProgram(Instruction.CMOV_NZ, 0, 1, 12);
      compareInterpreters("CMOV_NZ nsat", buildProgram(code, mask), 100, (r) => {
        setReg(r, 0, 99n);
        setReg(r, 1, 0n);
      });
    });
  });

  describe("conditional move immediate", () => {
    it("CMOV_IZ_IMM: condition zero, load imm", () => {
      const { code, mask } = twoRegImmProgram(Instruction.CMOV_IZ_IMM, 12, 0, immLE(42, 4));
      compareInterpreters("CMOV_IZ_IMM sat", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0n));
    });
    it("CMOV_IZ_IMM: condition non-zero, no load", () => {
      const { code, mask } = twoRegImmProgram(Instruction.CMOV_IZ_IMM, 12, 0, immLE(42, 4));
      compareInterpreters("CMOV_IZ_IMM nsat", buildProgram(code, mask), 100, (r) => setReg(r, 0, 3n));
    });
    it("CMOV_NZ_IMM: condition non-zero, load imm", () => {
      const { code, mask } = twoRegImmProgram(Instruction.CMOV_NZ_IMM, 12, 0, immLE(42, 4));
      compareInterpreters("CMOV_NZ_IMM sat", buildProgram(code, mask), 100, (r) => setReg(r, 0, 3n));
    });
    it("CMOV_NZ_IMM: condition zero, no load", () => {
      const { code, mask } = twoRegImmProgram(Instruction.CMOV_NZ_IMM, 12, 0, immLE(42, 4));
      compareInterpreters("CMOV_NZ_IMM nsat", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0n));
    });
  });

  // ===== IMMEDIATE ARITHMETIC (adapted from math-ops.test.ts) =====

  describe("immediate arithmetic", () => {
    it("ADD_IMM_32: rb + imm", () => {
      const { code, mask } = twoRegImmProgram(Instruction.ADD_IMM_32, 12, 0, immLE(100, 4));
      compareInterpreters("ADD_IMM32", buildProgram(code, mask), 100, (r) => setReg(r, 0, 50n));
    });
    it("ADD_IMM_32: overflow", () => {
      const { code, mask } = twoRegImmProgram(Instruction.ADD_IMM_32, 12, 0, immLE(-1, 4));
      compareInterpreters("ADD_IMM32 ov", buildProgram(code, mask), 100, (r) => setReg(r, 0, 2n ** 32n - 1n));
    });
    it("ADD_IMM_64: rb + imm", () => {
      const { code, mask } = twoRegImmProgram(Instruction.ADD_IMM_64, 12, 0, immLE(100, 4));
      compareInterpreters("ADD_IMM64", buildProgram(code, mask), 100, (r) => setReg(r, 0, 50n));
    });
    it("NEG_ADD_IMM_32: imm - rb", () => {
      const { code, mask } = twoRegImmProgram(Instruction.NEG_ADD_IMM_32, 12, 0, immLE(100, 4));
      compareInterpreters("NEG_ADD_IMM32", buildProgram(code, mask), 100, (r) => setReg(r, 0, 30n));
    });
    it("NEG_ADD_IMM_32: overflow (imm - rb wraps)", () => {
      const { code, mask } = twoRegImmProgram(Instruction.NEG_ADD_IMM_32, 12, 0, immLE(12, 4));
      compareInterpreters("NEG_ADD_IMM32 ov", buildProgram(code, mask), 100, (r) => setReg(r, 0, 13n));
    });
    it("NEG_ADD_IMM_64: imm - rb", () => {
      const { code, mask } = twoRegImmProgram(Instruction.NEG_ADD_IMM_64, 12, 0, immLE(100, 4));
      compareInterpreters("NEG_ADD_IMM64", buildProgram(code, mask), 100, (r) => setReg(r, 0, 30n));
    });
    it("MUL_IMM_32: rb * imm", () => {
      const { code, mask } = twoRegImmProgram(Instruction.MUL_IMM_32, 12, 0, immLE(12, 4));
      compareInterpreters("MUL_IMM32", buildProgram(code, mask), 100, (r) => setReg(r, 0, 13n));
    });
    it("MUL_IMM_64: rb * imm", () => {
      const { code, mask } = twoRegImmProgram(Instruction.MUL_IMM_64, 12, 0, immLE(12, 4));
      compareInterpreters("MUL_IMM64", buildProgram(code, mask), 100, (r) => setReg(r, 0, 13n));
    });
  });

  // ===== BITWISE IMMEDIATE =====

  describe("bitwise immediate", () => {
    it("AND_IMM: 0b101 & 0b011 = 0b001", () => {
      const { code, mask } = twoRegImmProgram(Instruction.AND_IMM, 12, 0, immLE(0b011, 4));
      compareInterpreters("AND_IMM", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0b101n));
    });
    it("OR_IMM: 0b01 | 0b10 = 0b11", () => {
      const { code, mask } = twoRegImmProgram(Instruction.OR_IMM, 12, 0, immLE(0b10, 4));
      compareInterpreters("OR_IMM", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0b01n));
    });
    it("XOR_IMM: 0b101 ^ 0b110 = 0b011", () => {
      const { code, mask } = twoRegImmProgram(Instruction.XOR_IMM, 12, 0, immLE(0b110, 4));
      compareInterpreters("XOR_IMM", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0b101n));
    });
  });

  // ===== LOAD IMMEDIATE =====

  describe("load immediate", () => {
    it("LOAD_IMM: r0 = -1", () => {
      const code = [Instruction.LOAD_IMM, 0x00, 0xff, Instruction.TRAP];
      const mask = [true, false, false, true];
      compareInterpreters("LOAD_IMM -1", buildProgram(code, mask), 100);
    });
    it("LOAD_IMM: r1 = 42", () => {
      const code = [Instruction.LOAD_IMM, 0x01, 42, Instruction.TRAP];
      const mask = [true, false, false, true];
      compareInterpreters("LOAD_IMM 42", buildProgram(code, mask), 100);
    });
    it("LOAD_IMM: r0 = 0 (empty imm)", () => {
      const code = [Instruction.LOAD_IMM, 0x00, Instruction.TRAP];
      const mask = [true, false, true];
      compareInterpreters("LOAD_IMM 0", buildProgram(code, mask), 100);
    });
  });

  // ===== BRANCH OPERATIONS =====

  describe("branch operations", () => {
    it("JUMP to TRAP", () => {
      const code = [Instruction.JUMP, 2, Instruction.TRAP];
      const mask = [true, false, true];
      compareInterpreters("JUMP", buildProgram(code, mask), 100);
    });

    it("BRANCH_EQ: taken", () => {
      const code = [Instruction.BRANCH_EQ, 0x10, 4, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, true, true];
      compareInterpreters("BR_EQ taken", buildProgram(code, mask), 100, (r) => {
        setReg(r, 0, 42n);
        setReg(r, 1, 42n);
      });
    });
    it("BRANCH_EQ: not taken", () => {
      const code = [Instruction.BRANCH_EQ, 0x10, 4, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, true, true];
      compareInterpreters("BR_EQ ntaken", buildProgram(code, mask), 100, (r) => {
        setReg(r, 0, 42n);
        setReg(r, 1, 99n);
      });
    });

    it("BRANCH_NE: taken", () => {
      const code = [Instruction.BRANCH_NE, 0x10, 4, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, true, true];
      compareInterpreters("BR_NE taken", buildProgram(code, mask), 100, (r) => {
        setReg(r, 0, 42n);
        setReg(r, 1, 99n);
      });
    });
    it("BRANCH_NE: not taken", () => {
      const code = [Instruction.BRANCH_NE, 0x10, 4, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, true, true];
      compareInterpreters("BR_NE ntaken", buildProgram(code, mask), 100, (r) => {
        setReg(r, 0, 42n);
        setReg(r, 1, 42n);
      });
    });

    it("BRANCH_LT_U: taken (5 < 10)", () => {
      const code = [Instruction.BRANCH_LT_U, 0x10, 4, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, true, true];
      compareInterpreters("BR_LT_U taken", buildProgram(code, mask), 100, (r) => {
        setReg(r, 0, 5n);
        setReg(r, 1, 10n);
      });
    });
    it("BRANCH_LT_U: not taken (10 < 5)", () => {
      const code = [Instruction.BRANCH_LT_U, 0x10, 4, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, true, true];
      compareInterpreters("BR_LT_U ntaken", buildProgram(code, mask), 100, (r) => {
        setReg(r, 0, 10n);
        setReg(r, 1, 5n);
      });
    });

    it("BRANCH_GE_U: taken (10 >= 5)", () => {
      const code = [Instruction.BRANCH_GE_U, 0x10, 4, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, true, true];
      compareInterpreters("BR_GE_U taken", buildProgram(code, mask), 100, (r) => {
        setReg(r, 0, 10n);
        setReg(r, 1, 5n);
      });
    });
    it("BRANCH_GE_U: not taken (3 >= 10)", () => {
      const code = [Instruction.BRANCH_GE_U, 0x10, 4, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, true, true];
      compareInterpreters("BR_GE_U ntaken", buildProgram(code, mask), 100, (r) => {
        setReg(r, 0, 3n);
        setReg(r, 1, 10n);
      });
    });

    it("BRANCH_LT_S: taken (-5 < 3)", () => {
      const code = [Instruction.BRANCH_LT_S, 0x10, 4, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, true, true];
      compareInterpreters("BR_LT_S taken", buildProgram(code, mask), 100, (r) => {
        setReg(r, 0, -5n);
        setReg(r, 1, 3n);
      });
    });
    it("BRANCH_LT_S: not taken (3 < -5)", () => {
      const code = [Instruction.BRANCH_LT_S, 0x10, 4, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, true, true];
      compareInterpreters("BR_LT_S ntaken", buildProgram(code, mask), 100, (r) => {
        setReg(r, 0, 3n);
        setReg(r, 1, -5n);
      });
    });

    it("BRANCH_GE_S: taken (3 >= -5)", () => {
      const code = [Instruction.BRANCH_GE_S, 0x10, 4, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, true, true];
      compareInterpreters("BR_GE_S taken", buildProgram(code, mask), 100, (r) => {
        setReg(r, 0, 3n);
        setReg(r, 1, -5n);
      });
    });
    it("BRANCH_GE_S: not taken (-5 >= 3)", () => {
      const code = [Instruction.BRANCH_GE_S, 0x10, 4, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, true, true];
      compareInterpreters("BR_GE_S ntaken", buildProgram(code, mask), 100, (r) => {
        setReg(r, 0, -5n);
        setReg(r, 1, 3n);
      });
    });
  });

  // ===== BRANCH IMMEDIATE =====

  describe("branch immediate", () => {
    // BRANCH_EQ_IMM: ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET
    // Format: [opcode] [ra_lo | immLen_hi] [imm bytes...] [offset bytes...]
    // This is complex to encode manually, so we use a simpler approach:
    // Build programs that let both interpreters handle the encoding the same way.

    it("BRANCH_EQ_IMM: taken (r0 == 42)", () => {
      // opcode, byte1=ra(0)|immLen, imm(42), offset(to pos 5)
      const code = [Instruction.BRANCH_EQ_IMM, 0x00, 42, 5, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, false, true, true];
      compareInterpreters("BR_EQ_IMM taken", buildProgram(code, mask), 100, (r) => setReg(r, 0, 42n));
    });
    it("BRANCH_EQ_IMM: not taken (r0 != 42)", () => {
      const code = [Instruction.BRANCH_EQ_IMM, 0x00, 42, 5, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, false, true, true];
      compareInterpreters("BR_EQ_IMM ntaken", buildProgram(code, mask), 100, (r) => setReg(r, 0, 99n));
    });

    it("BRANCH_NE_IMM: taken (r0 != 42)", () => {
      const code = [Instruction.BRANCH_NE_IMM, 0x00, 42, 5, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, false, true, true];
      compareInterpreters("BR_NE_IMM taken", buildProgram(code, mask), 100, (r) => setReg(r, 0, 99n));
    });
    it("BRANCH_NE_IMM: not taken (r0 == 42)", () => {
      const code = [Instruction.BRANCH_NE_IMM, 0x00, 42, 5, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, false, true, true];
      compareInterpreters("BR_NE_IMM ntaken", buildProgram(code, mask), 100, (r) => setReg(r, 0, 42n));
    });

    it("BRANCH_LT_U_IMM: taken (5 < 10)", () => {
      const code = [Instruction.BRANCH_LT_U_IMM, 0x00, 10, 5, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, false, true, true];
      compareInterpreters("BR_LT_U_IMM taken", buildProgram(code, mask), 100, (r) => setReg(r, 0, 5n));
    });
    it("BRANCH_LT_U_IMM: not taken (10 < 5)", () => {
      const code = [Instruction.BRANCH_LT_U_IMM, 0x00, 5, 5, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, false, true, true];
      compareInterpreters("BR_LT_U_IMM ntaken", buildProgram(code, mask), 100, (r) => setReg(r, 0, 10n));
    });

    it("BRANCH_GE_U_IMM: taken (10 >= 5)", () => {
      const code = [Instruction.BRANCH_GE_U_IMM, 0x00, 5, 5, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, false, true, true];
      compareInterpreters("BR_GE_U_IMM taken", buildProgram(code, mask), 100, (r) => setReg(r, 0, 10n));
    });

    it("BRANCH_LE_U_IMM: taken (5 <= 10)", () => {
      const code = [Instruction.BRANCH_LE_U_IMM, 0x00, 10, 5, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, false, true, true];
      compareInterpreters("BR_LE_U_IMM taken", buildProgram(code, mask), 100, (r) => setReg(r, 0, 5n));
    });

    it("BRANCH_GT_U_IMM: taken (10 > 5)", () => {
      const code = [Instruction.BRANCH_GT_U_IMM, 0x00, 5, 5, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, false, true, true];
      compareInterpreters("BR_GT_U_IMM taken", buildProgram(code, mask), 100, (r) => setReg(r, 0, 10n));
    });

    it("BRANCH_LT_S_IMM: taken (-5 < 3)", () => {
      const code = [Instruction.BRANCH_LT_S_IMM, 0x00, 3, 5, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, false, true, true];
      compareInterpreters("BR_LT_S_IMM taken", buildProgram(code, mask), 100, (r) => setReg(r, 0, -5n));
    });

    it("BRANCH_GE_S_IMM: taken (3 >= -5)", () => {
      // imm = -5 = 0xFB as single byte signed
      const code = [Instruction.BRANCH_GE_S_IMM, 0x00, 0xfb, 5, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, false, true, true];
      compareInterpreters("BR_GE_S_IMM taken", buildProgram(code, mask), 100, (r) => setReg(r, 0, 3n));
    });

    it("BRANCH_LE_S_IMM: taken (-5 <= 3)", () => {
      const code = [Instruction.BRANCH_LE_S_IMM, 0x00, 3, 5, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, false, true, true];
      compareInterpreters("BR_LE_S_IMM taken", buildProgram(code, mask), 100, (r) => setReg(r, 0, -5n));
    });

    it("BRANCH_GT_S_IMM: taken (3 > -5)", () => {
      const code = [Instruction.BRANCH_GT_S_IMM, 0x00, 0xfb, 5, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, false, true, true];
      compareInterpreters("BR_GT_S_IMM taken", buildProgram(code, mask), 100, (r) => setReg(r, 0, 3n));
    });
  });

  // ===== LOAD_IMM_JUMP =====

  describe("load_imm_jump", () => {
    it("LOAD_IMM_JUMP: load 42 into r0, jump to TRAP", () => {
      // ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET format
      // Loads imm into register, then jumps to offset
      const code = [Instruction.LOAD_IMM_JUMP, 0x00, 42, 5, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, false, true, true];
      compareInterpreters("LIJ", buildProgram(code, mask), 100);
    });

    it("LOAD_IMM_JUMP: load -1 into r0, jump to TRAP", () => {
      const code = [Instruction.LOAD_IMM_JUMP, 0x00, 0xff, 5, Instruction.TRAP, Instruction.TRAP];
      const mask = [true, false, false, false, true, true];
      compareInterpreters("LIJ neg", buildProgram(code, mask), 100);
    });
  });

  // ===== LOAD_IMM_64 =====

  describe("load_imm_64", () => {
    it("LOAD_IMM_64: load positive 64-bit value", () => {
      // ONE_REGISTER_ONE_EXTENDED_WIDTH_IMMEDIATE format:
      // [opcode] [ra_lo | ...] [8 bytes of imm64]
      // The skip table says 9 bytes after opcode byte
      const imm64Bytes = [0x78, 0x56, 0x34, 0x12, 0xef, 0xcd, 0xab, 0x09]; // 0x09abcdef12345678
      const code = [Instruction.LOAD_IMM_64, 0x00, ...imm64Bytes, Instruction.TRAP];
      const mask = [true, ...Array(9).fill(false), true];
      compareInterpreters("LI64 pos", buildProgram(code, mask), 100);
    });

    it("LOAD_IMM_64: load -1 (all 0xff)", () => {
      const imm64Bytes = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
      const code = [Instruction.LOAD_IMM_64, 0x00, ...imm64Bytes, Instruction.TRAP];
      const mask = [true, ...Array(9).fill(false), true];
      compareInterpreters("LI64 neg", buildProgram(code, mask), 100);
    });

    it("LOAD_IMM_64: load zero", () => {
      const imm64Bytes = [0, 0, 0, 0, 0, 0, 0, 0];
      const code = [Instruction.LOAD_IMM_64, 0x00, ...imm64Bytes, Instruction.TRAP];
      const mask = [true, ...Array(9).fill(false), true];
      compareInterpreters("LI64 zero", buildProgram(code, mask), 100);
    });

    it("LOAD_IMM_64: load large positive", () => {
      // 0x7fffffffffffffff
      const imm64Bytes = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f];
      const code = [Instruction.LOAD_IMM_64, 0x00, ...imm64Bytes, Instruction.TRAP];
      const mask = [true, ...Array(9).fill(false), true];
      compareInterpreters("LI64 maxpos", buildProgram(code, mask), 100);
    });

    it("LOAD_IMM_64: into r12", () => {
      const imm64Bytes = [0xab, 0xcd, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
      const code = [Instruction.LOAD_IMM_64, 0x0c, ...imm64Bytes, Instruction.TRAP];
      const mask = [true, ...Array(9).fill(false), true];
      compareInterpreters("LI64 r12", buildProgram(code, mask), 100);
    });
  });

  // ===== ECALLI / HOST CALL =====

  describe("ecalli / host call", () => {
    it("ECALLI: sets HOST status with exitParam=0", () => {
      // ONE_IMMEDIATE format: [opcode] [imm byte(s)]
      const code = [Instruction.ECALLI, 0x00, Instruction.TRAP];
      const mask = [true, false, true];
      const program = buildProgram(code, mask);

      const oldInterpreter = new OldInterpreter();
      const liteInterpreter = new LiteInterpreter();

      oldInterpreter.resetGeneric(program, 0, tryAsGas(100));
      liteInterpreter.resetGeneric(program, 0, tryAsGas(100));

      oldInterpreter.runProgram();
      liteInterpreter.runProgram();

      assert.equal(liteInterpreter.getStatus(), Status.HOST);
      assert.equal(liteInterpreter.getStatus(), oldInterpreter.getStatus());
      assert.equal(liteInterpreter.getExitParam(), oldInterpreter.getExitParam());
    });

    it("ECALLI: sets HOST status with exitParam=0x7f", () => {
      const code = [Instruction.ECALLI, 0x7f, Instruction.TRAP];
      const mask = [true, false, true];
      const program = buildProgram(code, mask);

      const oldInterpreter = new OldInterpreter();
      const liteInterpreter = new LiteInterpreter();

      oldInterpreter.resetGeneric(program, 0, tryAsGas(100));
      liteInterpreter.resetGeneric(program, 0, tryAsGas(100));

      oldInterpreter.runProgram();
      liteInterpreter.runProgram();

      assert.equal(liteInterpreter.getStatus(), Status.HOST);
      assert.equal(liteInterpreter.getStatus(), oldInterpreter.getStatus());
      assert.equal(liteInterpreter.getExitParam(), oldInterpreter.getExitParam());
    });

    it("ECALLI: resumes after HOST call", () => {
      // ECALLI exits with HOST, then runProgram should resume at next instruction
      const code = [Instruction.ECALLI, 0x05, Instruction.TRAP];
      const mask = [true, false, true];
      const program = buildProgram(code, mask);

      const oldInterpreter = new OldInterpreter();
      const liteInterpreter = new LiteInterpreter();

      oldInterpreter.resetGeneric(program, 0, tryAsGas(100));
      liteInterpreter.resetGeneric(program, 0, tryAsGas(100));

      // First run: should stop at HOST
      oldInterpreter.runProgram();
      liteInterpreter.runProgram();
      assert.equal(liteInterpreter.getStatus(), Status.HOST);
      assert.equal(oldInterpreter.getStatus(), Status.HOST);

      // Resume: should continue to TRAP -> PANIC
      oldInterpreter.runProgram();
      liteInterpreter.runProgram();
      assert.equal(liteInterpreter.getStatus(), oldInterpreter.getStatus());
      assert.equal(liteInterpreter.getPC(), oldInterpreter.getPC());
    });
  });

  // ===== SBRK =====

  describe("sbrk", () => {
    it("SBRK: allocate one page, get old sbrk value", () => {
      // SBRK is TWO_REGISTERS: firstRegisterIndex = high nibble = source, secondRegisterIndex = low nibble = dest
      // We need: r0 = PAGE_SIZE (4096), SBRK puts old sbrk into rd
      // Load 4096 = 0x1000 into r0, then SBRK with source=r0 dest=r12
      const PAGE_SIZE = 4096;
      const imm = immLE(PAGE_SIZE, 4);
      // LOAD_IMM r0 = 4096
      const loadCode = [Instruction.LOAD_IMM, 0x00, ...imm];
      const loadMask = [true, ...Array(1 + imm.length).fill(false)];
      // SBRK: TWO_REGISTERS: byte1 = (source << 4) | dest = (0 << 4) | 12 = 0x0c
      const sbrkCode = [Instruction.SBRK, 0x0c];
      const sbrkMask = [true, false];
      // TRAP
      const code = [...loadCode, ...sbrkCode, Instruction.TRAP];
      const mask = [...loadMask, ...sbrkMask, true];
      compareInterpreters("SBRK alloc", buildProgram(code, mask), 100);
    });

    it("SBRK: allocate two pages sequentially", () => {
      const PAGE_SIZE = 4096;
      const imm = immLE(PAGE_SIZE, 4);
      // LOAD_IMM r0 = 4096
      const loadCode = [Instruction.LOAD_IMM, 0x00, ...imm];
      const loadMask = [true, ...Array(1 + imm.length).fill(false)];
      // First SBRK: source=r0, dest=r1 -> byte1 = (0 << 4) | 1 = 0x01
      const sbrk1Code = [Instruction.SBRK, 0x01];
      const sbrk1Mask = [true, false];
      // Second SBRK: source=r0, dest=r2 -> byte1 = (0 << 4) | 2 = 0x02
      const sbrk2Code = [Instruction.SBRK, 0x02];
      const sbrk2Mask = [true, false];
      // TRAP
      const code = [...loadCode, ...sbrk1Code, ...sbrk2Code, Instruction.TRAP];
      const mask = [...loadMask, ...sbrk1Mask, ...sbrk2Mask, true];
      compareInterpreters("SBRK alloc2", buildProgram(code, mask), 100);
    });
  });

  // ===== LOAD/STORE MEMORY =====

  describe("memory load/store", () => {
    it("load from unmapped page -> FAULT (both interpreters agree)", () => {
      // Load from address that's well beyond reserved range but unmapped
      // Use a large address via LOAD_U8 with immediate
      const addrBytes = immLE(0x80000, 4); // 524288 - way past reserved pages
      const code = [Instruction.LOAD_U8, 0x00, ...addrBytes, Instruction.TRAP];
      const mask = [true, ...Array(1 + addrBytes.length).fill(false), true];
      compareInterpreters("load fault", buildProgram(code, mask), 100);
    });

    it("store to unmapped page -> FAULT (both interpreters agree)", () => {
      const addrBytes = immLE(0x80000, 4);
      const code = [Instruction.STORE_U8, 0x00, ...addrBytes, Instruction.TRAP];
      const mask = [true, ...Array(1 + addrBytes.length).fill(false), true];
      compareInterpreters("store fault", buildProgram(code, mask), 100);
    });

    it("LOAD_IND_U8 from unmapped (reg + imm)", () => {
      // r0 = 0x80000 (unmapped), imm = 0. LOAD_IND_U8 ra=r1(dest) rb=r0(addr)
      // byte1 = (0 << 4) | 1 = 0x01
      const code = [Instruction.LOAD_IND_U8, 0x01, 0x00, Instruction.TRAP];
      const mask = [true, false, false, true];
      compareInterpreters("load_ind fault", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0x80000n));
    });

    it("STORE_IND_U64 to unmapped (reg + imm)", () => {
      // Use a clearly unmapped address with register as source
      // ra=low=r0(addr reg), rb=high=r1(value reg)
      // byte1 = (1 << 4) | 0 = 0x10
      const code = [Instruction.STORE_IND_U64, 0x10, 0x00, Instruction.TRAP];
      const mask = [true, false, false, true];
      compareInterpreters("store_ind64 fault", buildProgram(code, mask), 100, (r) => {
        setReg(r, 0, 0x80000n);
        setReg(r, 1, 42n);
      });
    });
  });

  // ===== DYNAMIC JUMPS =====

  describe("dynamic jumps", () => {
    /**
     * Build a program with a jump table for dynamic jump testing.
     *
     * Jump table works as follows:
     * - address = reg + imm (unsigned)
     * - index = address / JUMP_ALIGNMENT_FACTOR - 1 (JUMP_ALIGNMENT_FACTOR = 2)
     * - destination = jumpTable[index]
     *
     * So to reach jump table entry 0, address must be 2 (2/2 - 1 = 0).
     * To reach entry 1, address must be 4 (4/2 - 1 = 1).
     *
     * EXIT_ADDRESS = 0xFFFF0000 means HALT.
     * Address 0 means PANIC.
     * Odd address means PANIC.
     */

    it("JUMP_IND: valid jump through jump table", () => {
      // Jump table entry 0 -> destination = 4 (points to TRAP at offset 4)
      // We need: address = 2 so index = 0. Set r0 = 2, imm = 0.
      // JUMP_IND: ONE_REGISTER_ONE_IMMEDIATE
      // byte1: low nibble = ra = r0 = 0x00
      const code = [
        Instruction.JUMP_IND,
        0x00,
        0x00, // imm=0
        Instruction.TRAP, // offset 3 (not reached, not a block start)
        Instruction.TRAP, // offset 4 (jump target, must be block start)
      ];
      const mask = [true, false, false, true, true];
      // Jump table: 1 entry pointing to offset 4
      // Jump table item length = 1 byte
      const program = buildProgram(code, mask, [4], 1);
      compareInterpreters("JUMP_IND valid", program, 100, (r) => setReg(r, 0, 2n));
    });

    it("JUMP_IND: address=EXIT_ADDRESS -> HALT", () => {
      // EXIT_ADDRESS = 0xFFFF0000
      const code = [Instruction.JUMP_IND, 0x00, 0x00, Instruction.TRAP];
      const mask = [true, false, false, true];
      const program = buildProgram(code, mask, [0], 1);
      compareInterpreters("JUMP_IND halt", program, 100, (r) => setReg(r, 0, 0xffff0000n));
    });

    it("JUMP_IND: address=0 -> PANIC", () => {
      const code = [Instruction.JUMP_IND, 0x00, 0x00, Instruction.TRAP];
      const mask = [true, false, false, true];
      const program = buildProgram(code, mask, [0], 1);
      compareInterpreters("JUMP_IND panic0", program, 100, (r) => setReg(r, 0, 0n));
    });

    it("JUMP_IND: odd address -> PANIC", () => {
      const code = [Instruction.JUMP_IND, 0x00, 0x00, Instruction.TRAP];
      const mask = [true, false, false, true];
      const program = buildProgram(code, mask, [0], 1);
      compareInterpreters("JUMP_IND odd", program, 100, (r) => setReg(r, 0, 3n));
    });

    it("JUMP_IND: index out of jump table range -> PANIC", () => {
      const code = [Instruction.JUMP_IND, 0x00, 0x00, Instruction.TRAP];
      const mask = [true, false, false, true];
      // Jump table has 1 entry (index 0). Address=4 -> index=1 -> out of range.
      const program = buildProgram(code, mask, [0], 1);
      compareInterpreters("JUMP_IND oor", program, 100, (r) => setReg(r, 0, 4n));
    });

    it("JUMP_IND: address overflow (wraps u32)", () => {
      // r0 = 0xFFFFFFFF, imm = 5, address = (0xFFFFFFFF + 5) >>> 0 = 4
      // index = 4/2 - 1 = 1 -> entry 1
      const code = [
        Instruction.JUMP_IND,
        0x00,
        0x05, // imm=5
        Instruction.TRAP,
        Instruction.TRAP, // offset 4 (dest for entry 1)
      ];
      const mask = [true, false, false, true, true];
      const program = buildProgram(code, mask, [0, 4], 1);
      compareInterpreters("JUMP_IND overflow", program, 100, (r) => setReg(r, 0, 0xffffffffn));
    });

    it("LOAD_IMM_JUMP_IND: load imm and jump", () => {
      // TWO_REGISTERS_TWO_IMMEDIATES format:
      // [opcode] [ra_lo|rb_hi] [immLen_lo|...] [imm1 bytes] [imm2 bytes]
      // ra = low(byte1) = dest for loaded imm
      // rb = high(byte1) = source register for jump address
      // byte2 low nibble = firstImmLen
      // imm1 = value to load into ra (signed)
      // imm2 = added to rb for jump address (unsigned)

      // We want: load 42 into r0, jump via r1+0
      // Set r1 = 2 (-> index 0 -> jump table entry 0)
      // ra=0, rb=1 -> byte1 = (1 << 4) | 0 = 0x10
      // firstImmLen = 1 byte -> byte2 = 0x01
      // imm1 = 42 (1 byte)
      // imm2 = 0 (remaining bytes)
      const code = [
        Instruction.LOAD_IMM_JUMP_IND,
        0x10, // ra=0, rb=1
        0x01, // firstImmLen=1
        42, // imm1=42
        0x00, // imm2=0
        Instruction.TRAP, // offset 5 (jump target)
      ];
      const mask = [true, false, false, false, false, true];
      const program = buildProgram(code, mask, [5], 1);
      compareInterpreters("LIJI", program, 100, (r) => setReg(r, 1, 2n));
    });

    it("LOAD_IMM_JUMP_IND: halt via EXIT_ADDRESS", () => {
      // r1 = 0xFFFF0000 = EXIT_ADDRESS, imm2 = 0
      const code = [
        Instruction.LOAD_IMM_JUMP_IND,
        0x10, // ra=0, rb=1
        0x01, // firstImmLen=1
        99, // imm1=99
        0x00, // imm2=0
        Instruction.TRAP,
      ];
      const mask = [true, false, false, false, false, true];
      const program = buildProgram(code, mask, [5], 1);
      compareInterpreters("LIJI halt", program, 100, (r) => setReg(r, 1, 0xffff0000n));
    });
  });

  // ===== GAS COUNTER =====

  describe("gas counter", () => {
    it("exact gas for single instruction", () => {
      const program = buildProgram([Instruction.TRAP], [true]);
      compareInterpreters("gas exact", program, 1);
    });

    it("zero gas -> OOG immediately", () => {
      const program = buildProgram([Instruction.TRAP], [true]);
      compareInterpreters("gas zero", program, 0);
    });

    it("multi-instruction gas tracking", () => {
      // 3 FALLTHROUGH + TRAP = 4 instructions. Gas=3 -> OOG at 4th instruction.
      const code = [Instruction.FALLTHROUGH, Instruction.FALLTHROUGH, Instruction.FALLTHROUGH, Instruction.TRAP];
      const mask = [true, true, true, true];
      compareInterpreters("gas multi", buildProgram(code, mask), 3);
    });

    it("gas=2 with 3 instructions -> OOG", () => {
      const code = [Instruction.FALLTHROUGH, Instruction.FALLTHROUGH, Instruction.TRAP];
      const mask = [true, true, true];
      compareInterpreters("gas oog", buildProgram(code, mask), 2);
    });
  });

  // ===== SHIFT IMMEDIATE OVERFLOW (edge cases) =====

  describe("shift immediate overflow edge cases", () => {
    it("SHLO_L_IMM_32: shift by 0", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHLO_L_IMM_32, 12, 0, immLE(0, 4));
      compareInterpreters("SLL_IMM32 zero", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0xabn));
    });

    it("SHLO_L_IMM_32: shift by 32 (wraps to 0)", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHLO_L_IMM_32, 12, 0, immLE(32, 4));
      compareInterpreters("SLL_IMM32 32", buildProgram(code, mask), 100, (r) => setReg(r, 0, 1n));
    });

    it("SHLO_R_IMM_32: shift by 35 (wraps to 3)", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHLO_R_IMM_32, 12, 0, immLE(35, 4));
      compareInterpreters("SRL_IMM32 35", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0b10000n));
    });

    it("SHAR_R_IMM_32: shift by 33 (wraps to 1)", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHAR_R_IMM_32, 12, 0, immLE(33, 4));
      compareInterpreters("SAR_IMM32 33", buildProgram(code, mask), 100, (r) => setReg(r, 0, -8n));
    });

    it("SHLO_L_IMM_64: shift by 67 (wraps to 3)", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHLO_L_IMM_64, 12, 0, immLE(67, 4));
      compareInterpreters("SLL_IMM64 67", buildProgram(code, mask), 100, (r) => setReg(r, 0, 1n));
    });

    it("SHLO_R_IMM_64: shift by 67 (wraps to 3)", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHLO_R_IMM_64, 12, 0, immLE(67, 4));
      compareInterpreters("SRL_IMM64 67", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0b10000n));
    });

    it("SHAR_R_IMM_64: shift by 67 (wraps to 3)", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHAR_R_IMM_64, 12, 0, immLE(67, 4));
      compareInterpreters("SAR_IMM64 67", buildProgram(code, mask), 100, (r) => setReg(r, 0, -8n));
    });

    it("SHLO_L_IMM_ALT_32: shift by 35 (wraps to 3)", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHLO_L_IMM_ALT_32, 12, 0, immLE(1, 4));
      compareInterpreters("SLL_ALT32 35", buildProgram(code, mask), 100, (r) => setReg(r, 0, 35n));
    });

    it("SHLO_R_IMM_ALT_32: shift by 35 (wraps to 3)", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHLO_R_IMM_ALT_32, 12, 0, immLE(0b10000, 4));
      compareInterpreters("SRL_ALT32 35", buildProgram(code, mask), 100, (r) => setReg(r, 0, 35n));
    });

    it("SHAR_R_IMM_ALT_32: shift by 33 (wraps to 1)", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHAR_R_IMM_ALT_32, 12, 0, immLE(-8, 4));
      compareInterpreters("SAR_ALT32 33", buildProgram(code, mask), 100, (r) => setReg(r, 0, 33n));
    });

    it("SHLO_L_IMM_ALT_64: shift by 67 (wraps to 3)", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHLO_L_IMM_ALT_64, 12, 0, immLE(1, 4));
      compareInterpreters("SLL_ALT64 67", buildProgram(code, mask), 100, (r) => setReg(r, 0, 67n));
    });

    it("SHLO_R_IMM_ALT_64: shift by 67 (wraps to 3)", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHLO_R_IMM_ALT_64, 12, 0, immLE(0b10000, 4));
      compareInterpreters("SRL_ALT64 67", buildProgram(code, mask), 100, (r) => setReg(r, 0, 67n));
    });

    it("SHAR_R_IMM_ALT_64: shift by 67 (wraps to 3)", () => {
      const { code, mask } = twoRegImmProgram(Instruction.SHAR_R_IMM_ALT_64, 12, 0, immLE(-8, 4));
      compareInterpreters("SAR_ALT64 67", buildProgram(code, mask), 100, (r) => setReg(r, 0, 67n));
    });
  });

  // ===== ADDITIONAL EDGE CASES =====

  describe("additional edge cases", () => {
    it("DIV_U_32: max / 1", () => testThreeReg("DIV_U_32 max", Instruction.DIV_U_32, 0xffffffffn, 1n));
    it("DIV_S_32: min signed / 1", () => testThreeReg("DIV_S_32 min", Instruction.DIV_S_32, -(2n ** 31n), 1n));
    it("REM_S_32: min / -1", () => testThreeReg("REM_S_32 min/-1", Instruction.REM_S_32, -(2n ** 31n), -1n));
    it("REM_S_32: by zero", () => testThreeReg("REM_S_32 zero", Instruction.REM_S_32, 25n, 0n));

    it("REM_U_64: max % 1 = 0", () => testThreeReg("REM_U_64 max", Instruction.REM_U_64, 2n ** 64n - 1n, 1n));
    it("REM_S_64: min / -1", () => testThreeReg("REM_S_64 min/-1", Instruction.REM_S_64, -(2n ** 63n), -1n));
    it("REM_S_64: by zero", () => testThreeReg("REM_S_64 zero", Instruction.REM_S_64, 25n, 0n));

    it("ADD_32: both zero", () => testThreeReg("ADD_32 zero", Instruction.ADD_32, 0n, 0n));
    it("SUB_32: same value", () => testThreeReg("SUB_32 same", Instruction.SUB_32, 42n, 42n));
    it("MUL_32: by zero", () => testThreeReg("MUL_32 zero", Instruction.MUL_32, 42n, 0n));
    it("MUL_32: by one", () => testThreeReg("MUL_32 one", Instruction.MUL_32, 42n, 1n));

    it("ADD_64: max + 1 = 0", () => testThreeReg("ADD_64 overflow", Instruction.ADD_64, 2n ** 64n - 1n, 1n));
    it("SUB_64: 0 - 1 = max", () => testThreeReg("SUB_64 underflow", Instruction.SUB_64, 0n, 1n));
    it("MUL_64: max * max", () => testThreeReg("MUL_64 max", Instruction.MUL_64, 2n ** 64n - 1n, 2n ** 64n - 1n));

    it("MIN: equal values", () => testThreeReg("MIN eq", Instruction.MIN, 42n, 42n));
    it("MAX: equal values", () => testThreeReg("MAX eq", Instruction.MAX, 42n, 42n));
    it("MIN_U: equal values", () => testThreeReg("MIN_U eq", Instruction.MIN_U, 42n, 42n));
    it("MAX_U: equal values", () => testThreeReg("MAX_U eq", Instruction.MAX_U, 42n, 42n));

    it("SET_LT_U: equal values -> 0", () => testThreeReg("SLT_U eq", Instruction.SET_LT_U, 5n, 5n));
    it("SET_LT_S: equal values -> 0", () => testThreeReg("SLT_S eq", Instruction.SET_LT_S, -5n, -5n));

    it("AND: zero", () => testThreeReg("AND zero", Instruction.AND, 0n, 0xffffffffn));
    it("OR: zero", () => testThreeReg("OR zero", Instruction.OR, 0n, 0n));
    it("XOR: same -> 0", () => testThreeReg("XOR same", Instruction.XOR, 0xdeadbeefn, 0xdeadbeefn));

    it("ROT_L_64: by 1", () => testThreeReg("RL64 by1", Instruction.ROT_L_64, 0x8000000000000001n, 1n));
    it("ROT_R_64: by 1", () => testThreeReg("RR64 by1", Instruction.ROT_R_64, 0x8000000000000001n, 1n));
    it("ROT_L_32: by 1", () => testThreeReg("RL32 by1", Instruction.ROT_L_32, 0x80000001n, 1n));
    it("ROT_R_32: by 1", () => testThreeReg("RR32 by1", Instruction.ROT_R_32, 0x80000001n, 1n));

    it("SIGN_EXTEND_8: 0 -> 0", () => testTwoReg("SE8 zero", Instruction.SIGN_EXTEND_8, 0n));
    it("SIGN_EXTEND_8: 0x7F -> 127", () => testTwoReg("SE8 max", Instruction.SIGN_EXTEND_8, 0x7fn));
    it("SIGN_EXTEND_8: 0xFF -> -1", () => testTwoReg("SE8 ff", Instruction.SIGN_EXTEND_8, 0xffn));
    it("SIGN_EXTEND_16: 0xFFFF -> -1", () => testTwoReg("SE16 ffff", Instruction.SIGN_EXTEND_16, 0xffffn));
    it("ZERO_EXTEND_16: 0xFFFF -> 0xFFFF", () =>
      testTwoReg("ZE16 ffff", Instruction.ZERO_EXTEND_16, 0xffff_ffff_ffffn));

    it("COUNT_SET_BITS_32: 0xFFFFFFFF -> 32", () =>
      testTwoReg("CSB32 all", Instruction.COUNT_SET_BITS_32, 0xffffffffn));
    it("COUNT_SET_BITS_64: 0x8000000000000001 -> 2", () =>
      testTwoReg("CSB64 edges", Instruction.COUNT_SET_BITS_64, 0x8000000000000001n));
    it("LEADING_ZERO_BITS_64: 1 -> 63", () => testTwoReg("CLZ64 one", Instruction.LEADING_ZERO_BITS_64, 1n));
    it("TRAILING_ZERO_BITS_64: 0x8000000000000000 -> 63", () =>
      testTwoReg("CTZ64 msb", Instruction.TRAILING_ZERO_BITS_64, 0x8000000000000000n));
    it("REVERSE_BYTES: 0x0102030405060708", () => testTwoReg("RB seq", Instruction.REVERSE_BYTES, 0x0102030405060708n));
  });

  // ===== MEMORY ROUND-TRIP (SBRK + STORE + LOAD) =====

  describe("memory round-trip", () => {
    /**
     * Build a program that:
     * 1. LOAD_IMM r0 = 4096 (one page)
     * 2. SBRK source=r0, dest=r1 → r1 = old sbrk (heap start address)
     * 3. LOAD_IMM r2 = <testValue> (value to store)
     * 4. STORE_IND_U8: mem[rb=r1 + imm=0] = ra=r2  → byte1 = (1<<4)|2 = 0x12
     * 5. LOAD_IND_U8: ra=r3(dest) = mem[rb=r1(addr) + imm=0]  → byte1 = (1<<4)|3 = 0x13
     * 6. TRAP
     *
     * After execution, r3 should contain the stored byte value.
     */
    it("SBRK + STORE_IND_U8 + LOAD_IND_U8: store and load byte", () => {
      const imm4096 = immLE(4096, 4);
      const testVal = immLE(0xab, 4);
      const code = [
        // Step 1: LOAD_IMM r0 = 4096
        Instruction.LOAD_IMM,
        0x00,
        ...imm4096,
        // Step 2: SBRK source=r0 dest=r1 → byte1 = (0<<4)|1 = 0x01
        Instruction.SBRK,
        0x01,
        // Step 3: LOAD_IMM r2 = 0xAB
        Instruction.LOAD_IMM,
        0x02,
        ...testVal,
        // Step 4: STORE_IND_U8: ra=r2(value) rb=r1(addr) imm=0 → byte1 = (1<<4)|2 = 0x12
        Instruction.STORE_IND_U8,
        0x12,
        0x00,
        // Step 5: LOAD_IND_U8: ra=r3(dest) rb=r1(addr) imm=0 → byte1 = (1<<4)|3 = 0x13
        Instruction.LOAD_IND_U8,
        0x13,
        0x00,
        // Step 6: TRAP
        Instruction.TRAP,
      ];
      const mask = [
        true,
        ...Array(1 + imm4096.length).fill(false), // LOAD_IMM r0
        true,
        false, // SBRK
        true,
        ...Array(1 + testVal.length).fill(false), // LOAD_IMM r2
        true,
        false,
        false, // STORE_IND_U8
        true,
        false,
        false, // LOAD_IND_U8
        true, // TRAP
      ];
      compareInterpreters("mem roundtrip u8", buildProgram(code, mask), 200);
    });

    it("SBRK + STORE_IND_U32 + LOAD_IND_U32: store and load 32-bit", () => {
      const imm4096 = immLE(4096, 4);
      const testVal = immLE(0x12345678, 4);
      const code = [
        Instruction.LOAD_IMM,
        0x00,
        ...imm4096,
        Instruction.SBRK,
        0x01,
        Instruction.LOAD_IMM,
        0x02,
        ...testVal,
        // STORE_IND_U32: ra=r2(value) rb=r1(addr) imm=0 → byte1 = (1<<4)|2 = 0x12
        Instruction.STORE_IND_U32,
        0x12,
        0x00,
        // LOAD_IND_U32: ra=r3(dest) rb=r1(addr) imm=0 → byte1 = (1<<4)|3 = 0x13
        Instruction.LOAD_IND_U32,
        0x13,
        0x00,
        Instruction.TRAP,
      ];
      const mask = [
        true,
        ...Array(1 + imm4096.length).fill(false),
        true,
        false,
        true,
        ...Array(1 + testVal.length).fill(false),
        true,
        false,
        false,
        true,
        false,
        false,
        true,
      ];
      compareInterpreters("mem roundtrip u32", buildProgram(code, mask), 200);
    });

    it("SBRK + STORE_IND_U64 + LOAD_IND_U64: store and load 64-bit", () => {
      const imm4096 = immLE(4096, 4);
      const code = [
        Instruction.LOAD_IMM,
        0x00,
        ...imm4096,
        Instruction.SBRK,
        0x01,
        // r2 already has 0 by default; set it via register setup
        // STORE_IND_U64: ra=r2(value) rb=r1(addr) imm=0 → byte1 = (1<<4)|2 = 0x12
        Instruction.STORE_IND_U64,
        0x12,
        0x00,
        // LOAD_IND_U64: ra=r3(dest) rb=r1(addr) imm=0 → byte1 = (1<<4)|3 = 0x13
        Instruction.LOAD_IND_U64,
        0x13,
        0x00,
        Instruction.TRAP,
      ];
      const mask = [
        true,
        ...Array(1 + imm4096.length).fill(false),
        true,
        false,
        true,
        false,
        false,
        true,
        false,
        false,
        true,
      ];
      compareInterpreters("mem roundtrip u64", buildProgram(code, mask), 200, (r) => {
        setReg(r, 2, 0xdeadbeefcafe1234n);
      });
    });

    it("SBRK + STORE_IND_U8 with offset: store at heap+10", () => {
      const imm4096 = immLE(4096, 4);
      const testVal = immLE(0x42, 4);
      const code = [
        Instruction.LOAD_IMM,
        0x00,
        ...imm4096,
        Instruction.SBRK,
        0x01,
        Instruction.LOAD_IMM,
        0x02,
        ...testVal,
        // STORE_IND_U8: ra=r2(value) rb=r1(addr) imm=10 → byte1 = (1<<4)|2 = 0x12
        Instruction.STORE_IND_U8,
        0x12,
        10,
        // LOAD_IND_U8: ra=r3(dest) rb=r1(addr) imm=10 → byte1 = (1<<4)|3 = 0x13
        Instruction.LOAD_IND_U8,
        0x13,
        10,
        Instruction.TRAP,
      ];
      const mask = [
        true,
        ...Array(1 + imm4096.length).fill(false),
        true,
        false,
        true,
        ...Array(1 + testVal.length).fill(false),
        true,
        false,
        false,
        true,
        false,
        false,
        true,
      ];
      compareInterpreters("mem roundtrip offset", buildProgram(code, mask), 200);
    });

    it("SBRK + multiple stores + loads: store two values, load both", () => {
      const imm4096 = immLE(4096, 4);
      const val1 = immLE(0xaa, 4);
      const val2 = immLE(0xbb, 4);
      const code = [
        // Allocate page
        Instruction.LOAD_IMM,
        0x00,
        ...imm4096,
        Instruction.SBRK,
        0x01, // r1 = heap start
        // Store 0xAA at offset 0
        Instruction.LOAD_IMM,
        0x02,
        ...val1,
        Instruction.STORE_IND_U8,
        0x12,
        0x00, // mem[r1+0] = r2
        // Store 0xBB at offset 1
        Instruction.LOAD_IMM,
        0x02,
        ...val2,
        Instruction.STORE_IND_U8,
        0x12,
        0x01, // mem[r1+1] = r2
        // Load both back
        Instruction.LOAD_IND_U8,
        0x13,
        0x00, // r3 = mem[r1+0]
        Instruction.LOAD_IND_U8,
        0x14,
        0x01, // r4 = mem[r1+1] → byte1 = (1<<4)|4 = 0x14
        Instruction.TRAP,
      ];
      const mask = [
        true,
        ...Array(1 + imm4096.length).fill(false),
        true,
        false,
        true,
        ...Array(1 + val1.length).fill(false),
        true,
        false,
        false,
        true,
        ...Array(1 + val2.length).fill(false),
        true,
        false,
        false,
        true,
        false,
        false,
        true,
        false,
        false,
        true,
      ];
      compareInterpreters("mem roundtrip multi", buildProgram(code, mask), 300);
    });
  });

  // ===== STORE_IMM (TWO_IMMEDIATES) - fault cases =====

  describe("store immediate fault", () => {
    it("STORE_IMM_U8: to unmapped address -> FAULT", () => {
      // TWO_IMMEDIATES: byte1 low nibble = firstImmLen
      // imm1 = address, imm2 = value
      // byte1 = 0x04 (firstImmLen=4)
      const addrBytes = immLE(0x80000, 4); // unmapped
      const code = [Instruction.STORE_IMM_U8, 0x04, ...addrBytes, 0xab, Instruction.TRAP];
      const mask = [true, ...Array(1 + addrBytes.length + 1).fill(false), true];
      compareInterpreters("STORE_IMM fault", buildProgram(code, mask), 100);
    });
  });

  // ===== GAS COUNTER UNIT TESTS =====

  describe("FastGasCounter", () => {
    it("subOne: counts down correctly", () => {
      const gc = new FastGasCounter(tryAsGas(3));
      assert.equal(gc.subOne(), false);
      assert.equal(gc.subOne(), false);
      assert.equal(gc.subOne(), false);
      assert.equal(gc.subOne(), true); // 4th -> OOG
    });

    it("subOne: gas=0 -> OOG immediately", () => {
      const gc = new FastGasCounter(tryAsGas(0));
      assert.equal(gc.subOne(), true);
    });

    it("subOne: gas=1 -> one step then OOG", () => {
      const gc = new FastGasCounter(tryAsGas(1));
      assert.equal(gc.subOne(), false);
      assert.equal(gc.subOne(), true);
    });

    it("get: returns remaining gas", () => {
      const gc = new FastGasCounter(tryAsGas(5));
      gc.subOne();
      gc.subOne();
      assert.equal(Number(gc.get()), 3);
    });

    it("used: returns consumed gas", () => {
      const gc = new FastGasCounter(tryAsGas(10));
      gc.subOne();
      gc.subOne();
      gc.subOne();
      assert.equal(Number(gc.used()), 3);
    });

    it("sub: subtracts bulk gas", () => {
      const gc = new FastGasCounter(tryAsGas(10));
      assert.equal(gc.sub(tryAsGas(5)), false);
      assert.equal(Number(gc.get()), 5);
    });

    it("sub: exact amount -> no OOG", () => {
      const gc = new FastGasCounter(tryAsGas(10));
      assert.equal(gc.sub(tryAsGas(10)), false);
      assert.equal(Number(gc.get()), 0);
    });

    it("sub: more than remaining -> OOG", () => {
      const gc = new FastGasCounter(tryAsGas(10));
      assert.equal(gc.sub(tryAsGas(11)), true);
    });

    it("set: throws error (not supported)", () => {
      const gc = new FastGasCounter(tryAsGas(10));
      assert.throws(() => gc.set(tryAsGas(5)), /FastGasCounter.set\(\) is not supported/);
    });
  });

  describe("BigGasCounter", () => {
    it("subOne: handles gas > MAX_SAFE_INTEGER", () => {
      const bigGas = tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 100n);
      const gc = new BigGasCounter(bigGas);
      assert.equal(gc.subOne(), false);
      assert.equal(BigInt(gc.get()), BigInt(Number.MAX_SAFE_INTEGER) + 99n);
    });

    it("subOne: small gas exhausts correctly", () => {
      const gc = new BigGasCounter(tryAsGas(2));
      assert.equal(gc.subOne(), false);
      assert.equal(gc.subOne(), false);
      assert.equal(gc.subOne(), true);
    });

    it("subOne: gas=0 -> OOG immediately", () => {
      const gc = new BigGasCounter(tryAsGas(0));
      assert.equal(gc.subOne(), true);
    });

    it("get: returns correct total for large values", () => {
      const val = BigInt(Number.MAX_SAFE_INTEGER) + 42n;
      const gc = new BigGasCounter(tryAsGas(val));
      assert.equal(BigInt(gc.get()), val);
    });

    it("used: tracks correctly across overflow boundary", () => {
      const bigGas = tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 10n);
      const gc = new BigGasCounter(bigGas);
      gc.subOne();
      gc.subOne();
      gc.subOne();
      assert.equal(BigInt(gc.used()), 3n);
    });

    it("sub: large cost within range", () => {
      const bigGas = tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 1000n);
      const gc = new BigGasCounter(bigGas);
      assert.equal(gc.sub(tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 500n)), false);
      assert.equal(BigInt(gc.get()), 500n);
    });

    it("sub: cost exceeds remaining -> OOG", () => {
      const bigGas = tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 1000n);
      const gc = new BigGasCounter(bigGas);
      gc.sub(tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 500n));
      assert.equal(gc.sub(tryAsGas(501)), true);
    });

    it("sub: small cost on large gas", () => {
      const bigGas = tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 100n);
      const gc = new BigGasCounter(bigGas);
      assert.equal(gc.sub(tryAsGas(50)), false);
      assert.equal(BigInt(gc.get()), BigInt(Number.MAX_SAFE_INTEGER) + 50n);
    });

    it("sub: exact amount -> no OOG", () => {
      const gc = new BigGasCounter(tryAsGas(100));
      assert.equal(gc.sub(tryAsGas(100)), false);
      assert.equal(BigInt(gc.get()), 0n);
    });

    it("sub: cost > MAX_SAFE_INTEGER on large gas", () => {
      const gas = BigInt(Number.MAX_SAFE_INTEGER) * 3n;
      const gc = new BigGasCounter(tryAsGas(gas));
      const cost = BigInt(Number.MAX_SAFE_INTEGER) * 2n;
      assert.equal(gc.sub(tryAsGas(cost)), false);
      assert.equal(BigInt(gc.get()), BigInt(Number.MAX_SAFE_INTEGER));
    });

    it("set: resets to large value", () => {
      const gc = new BigGasCounter(tryAsGas(100));
      gc.subOne();
      gc.set(tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 50n));
      assert.equal(BigInt(gc.get()), BigInt(Number.MAX_SAFE_INTEGER) + 50n);
    });

    it("set: resets to small value", () => {
      const bigGas = tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 100n);
      const gc = new BigGasCounter(bigGas);
      gc.set(tryAsGas(42));
      assert.equal(BigInt(gc.get()), 42n);
    });

    it("set: resets to zero", () => {
      const gc = new BigGasCounter(tryAsGas(100));
      gc.set(tryAsGas(0));
      assert.equal(BigInt(gc.get()), 0n);
      assert.equal(gc.subOne(), true);
    });
  });

  describe("createGasCounter", () => {
    it("selects FastGasCounter for small values", () => {
      const gc = createGasCounter(tryAsGas(1000));
      assert.ok(gc instanceof FastGasCounter);
    });

    it("selects BigGasCounter for large values", () => {
      const gc = createGasCounter(tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 1n));
      assert.ok(gc instanceof BigGasCounter);
    });

    it("selects FastGasCounter for MAX_SAFE_INTEGER exactly", () => {
      const gc = createGasCounter(tryAsGas(Number.MAX_SAFE_INTEGER));
      assert.ok(gc instanceof FastGasCounter);
    });

    it("forceBigGas: uses BigGasCounter even for small values", () => {
      const gc = createGasCounter(tryAsGas(100), true);
      assert.ok(gc instanceof BigGasCounter);
    });

    it("forceBigGas: set() works on small-value BigGasCounter", () => {
      const gc = createGasCounter(tryAsGas(100), true);
      gc.set(tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 1n));
      assert.equal(BigInt(gc.get()), BigInt(Number.MAX_SAFE_INTEGER) + 1n);
    });
  });

  // ===== MOVE_REG edge cases =====

  describe("move edge cases", () => {
    it("MOVE_REG: copy 0", () => {
      const { code, mask } = twoRegProgram(Instruction.MOVE_REG, 0, 12);
      compareInterpreters("MOVE zero", buildProgram(code, mask), 100, (r) => setReg(r, 0, 0n));
    });
    it("MOVE_REG: copy max u64", () => {
      const { code, mask } = twoRegProgram(Instruction.MOVE_REG, 0, 12);
      compareInterpreters("MOVE max", buildProgram(code, mask), 100, (r) => setReg(r, 0, 2n ** 64n - 1n));
    });
    it("MOVE_REG: copy negative", () => {
      const { code, mask } = twoRegProgram(Instruction.MOVE_REG, 0, 12);
      compareInterpreters("MOVE neg", buildProgram(code, mask), 100, (r) => setReg(r, 0, -1n));
    });
  });
});
