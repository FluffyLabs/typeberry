import assert from "node:assert";
import { describe, it } from "node:test";
import { BitVec } from "@typeberry/bytes";
import { Instruction } from "../instruction";
import { Mask } from "../program-decoder/mask";
import { ArgsDecoder } from "./args-decoder";
import { createResults } from "./args-decoding-results";
import { ArgumentType } from "./argument-type";
import { ImmediateDecoder } from "./decoders/immediate-decoder";

describe("ArgsDecoder", () => {
  it("return empty result for instruction without args", () => {
    const code = new Uint8Array([Instruction.TRAP]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0001]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const result = createResults()[ArgumentType.NO_ARGUMENTS];
    const expectedResult = {
      noOfBytesToSkip: code.length,
      type: ArgumentType.NO_ARGUMENTS,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return empty result for instruction without args (2 instructions)", () => {
    const code = new Uint8Array([Instruction.TRAP, Instruction.TRAP]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0011]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const result = createResults()[ArgumentType.NO_ARGUMENTS];
    const expectedResult = {
      noOfBytesToSkip: code.length / 2,
      type: ArgumentType.NO_ARGUMENTS,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 1 immediate", () => {
    const code = new Uint8Array([Instruction.ECALLI, 0xff]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0001]), code.length));

    const argsDecoder = new ArgsDecoder(code, mask);
    const expectedImmediateDecoder = new ImmediateDecoder();
    expectedImmediateDecoder.setBytes(new Uint8Array([0xff]));
    const result = createResults()[ArgumentType.ONE_IMMEDIATE];
    const expectedResult = {
      noOfBytesToSkip: code.length,
      type: ArgumentType.ONE_IMMEDIATE,
      immediateDecoder: expectedImmediateDecoder,
    };
    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 1 immediate (2 instructions)", () => {
    const code = new Uint8Array([Instruction.ECALLI, 0xff, Instruction.ECALLI, 0xff]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0101]), code.length));

    const argsDecoder = new ArgsDecoder(code, mask);
    const expectedImmediateDecoder = new ImmediateDecoder();
    expectedImmediateDecoder.setBytes(new Uint8Array([0xff]));
    const result = createResults()[ArgumentType.ONE_IMMEDIATE];
    const expectedResult = {
      noOfBytesToSkip: code.length / 2,
      type: ArgumentType.ONE_IMMEDIATE,
      immediateDecoder: expectedImmediateDecoder,
    };
    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 3 regs", () => {
    const code = new Uint8Array([Instruction.ADD, 0x12, 0x03]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0001]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const result = createResults()[ArgumentType.THREE_REGISTERS];
    const expectedResult = {
      noOfBytesToSkip: code.length,
      type: ArgumentType.THREE_REGISTERS,

      firstRegisterIndex: 1,
      secondRegisterIndex: 2,
      thirdRegisterIndex: 3,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 3 regs (2 instructions)", () => {
    const code = new Uint8Array([Instruction.ADD, 0x12, 0x03, Instruction.ADD, 0x12, 0x03]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const result = createResults()[ArgumentType.THREE_REGISTERS];
    const expectedResult = {
      noOfBytesToSkip: code.length / 2,
      type: ArgumentType.THREE_REGISTERS,

      firstRegisterIndex: 1,
      secondRegisterIndex: 2,
      thirdRegisterIndex: 3,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 2 regs and 1 immediate", () => {
    const code = new Uint8Array([Instruction.ADD_IMM, 0x12, 0xff]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0001]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const expectedImmediateDecoder = new ImmediateDecoder();
    expectedImmediateDecoder.setBytes(new Uint8Array([0xff]));
    const result = createResults()[ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE];
    const expectedResult = {
      noOfBytesToSkip: code.length,
      type: ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE,

      firstRegisterIndex: 1,
      secondRegisterIndex: 2,

      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 2 regs and 1 immediate (2 instructions)", () => {
    const code = new Uint8Array([Instruction.ADD_IMM, 0x12, 0xff, Instruction.ADD_IMM, 0x12, 0xff]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const expectedImmediateDecoder = new ImmediateDecoder();
    expectedImmediateDecoder.setBytes(new Uint8Array([0xff]));
    const result = createResults()[ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE];
    const expectedResult = {
      noOfBytesToSkip: code.length / 2,
      type: ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE,

      firstRegisterIndex: 1,
      secondRegisterIndex: 2,

      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 1 reg, 1 immediate and 1 offset", () => {
    const code = new Uint8Array([Instruction.BRANCH_EQ_IMM, 39, 210, 4, 6]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0001]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const expectedImmediateDecoder = new ImmediateDecoder();
    expectedImmediateDecoder.setBytes(new Uint8Array([210, 4]));
    const result = createResults()[ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET];
    const expectedResult = {
      noOfBytesToSkip: code.length,
      type: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET,
      registerIndex: 7,
      immediateDecoder: expectedImmediateDecoder,
      nextPc: 6,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 1 reg, 1 immediate and 1 offset (2 instructions)", () => {
    const code = new Uint8Array([Instruction.BRANCH_EQ_IMM, 39, 210, 4, 6, Instruction.BRANCH_EQ_IMM, 39, 210, 4, 6]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0010_0001, 0b0000_0000]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const expectedImmediateDecoder = new ImmediateDecoder();
    expectedImmediateDecoder.setBytes(new Uint8Array([210, 4]));
    const result = createResults()[ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET];
    const expectedResult = {
      noOfBytesToSkip: code.length / 2,
      type: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET,
      registerIndex: 7,
      immediateDecoder: expectedImmediateDecoder,
      nextPc: 6,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 2 regs and 1 offset", () => {
    const code = new Uint8Array([Instruction.BRANCH_EQ, 135, 4]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0001]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const expectedImmediateDecoder = new ImmediateDecoder();
    expectedImmediateDecoder.setBytes(new Uint8Array([0xff]));
    const result = createResults()[ArgumentType.TWO_REGISTERS_ONE_OFFSET];
    const expectedResult = {
      noOfBytesToSkip: code.length,
      type: ArgumentType.TWO_REGISTERS_ONE_OFFSET,

      firstRegisterIndex: 7,
      secondRegisterIndex: 8,

      nextPc: 4,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 2 regs and 1 offset (2 instructions)", () => {
    const code = new Uint8Array([Instruction.BRANCH_EQ, 135, 4, Instruction.BRANCH_EQ, 135, 4]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const expectedImmediateDecoder = new ImmediateDecoder();
    expectedImmediateDecoder.setBytes(new Uint8Array([0xff]));
    const result = createResults()[ArgumentType.TWO_REGISTERS_ONE_OFFSET];
    const expectedResult = {
      noOfBytesToSkip: code.length / 2,
      type: ArgumentType.TWO_REGISTERS_ONE_OFFSET,

      firstRegisterIndex: 7,
      secondRegisterIndex: 8,

      nextPc: 4,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 2 regs", () => {
    const code = new Uint8Array([Instruction.MOVE_REG, 0x12]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0001]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const result = createResults()[ArgumentType.TWO_REGISTERS];
    const expectedResult = {
      noOfBytesToSkip: code.length,
      type: ArgumentType.TWO_REGISTERS,

      firstRegisterIndex: 1,
      secondRegisterIndex: 2,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 2 regs (2 instructions)", () => {
    const code = new Uint8Array([Instruction.MOVE_REG, 0x12, Instruction.MOVE_REG, 0x12]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0101]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const result = createResults()[ArgumentType.TWO_REGISTERS];
    const expectedResult = {
      noOfBytesToSkip: code.length / 2,
      type: ArgumentType.TWO_REGISTERS,

      firstRegisterIndex: 1,
      secondRegisterIndex: 2,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 1 offset", () => {
    const code = new Uint8Array([Instruction.JUMP, 4]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0001]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const result = createResults()[ArgumentType.ONE_OFFSET];
    const expectedResult = {
      noOfBytesToSkip: code.length,
      type: ArgumentType.ONE_OFFSET,

      nextPc: 4,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 1 offset (2 instructions)", () => {
    const code = new Uint8Array([Instruction.JUMP, 4, Instruction.JUMP, 4]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0101]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const result = createResults()[ArgumentType.ONE_OFFSET];
    const expectedResult = {
      noOfBytesToSkip: code.length / 2,
      type: ArgumentType.ONE_OFFSET,

      nextPc: 4,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 1 reg and 1 immediate", () => {
    const code = new Uint8Array([Instruction.LOAD_IMM, 0x02, 0xff]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0001]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const expectedImmediateDecoder = new ImmediateDecoder();
    expectedImmediateDecoder.setBytes(new Uint8Array([0xff]));
    const result = createResults()[ArgumentType.ONE_REGISTER_ONE_IMMEDIATE];
    const expectedResult = {
      noOfBytesToSkip: code.length,
      type: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE,

      registerIndex: 2,

      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 1 reg and 1 immediate (2 instructions)", () => {
    const code = new Uint8Array([Instruction.LOAD_IMM, 0x02, 0xff, Instruction.LOAD_IMM, 0x02, 0xff]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_1001]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const expectedImmediateDecoder = new ImmediateDecoder();
    expectedImmediateDecoder.setBytes(new Uint8Array([0xff]));
    const result = createResults()[ArgumentType.ONE_REGISTER_ONE_IMMEDIATE];
    const expectedResult = {
      noOfBytesToSkip: code.length / 2,
      type: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE,

      registerIndex: 2,

      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 2 immediates", () => {
    const code = new Uint8Array([Instruction.STORE_IMM_U8, 1, 1, 2]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0001]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const expectedfirstImmediateDecoder = new ImmediateDecoder();
    expectedfirstImmediateDecoder.setBytes(new Uint8Array([0x01]));
    const expectedsecondImmediateDecoder = new ImmediateDecoder();
    expectedsecondImmediateDecoder.setBytes(new Uint8Array([0x02]));
    const result = createResults()[ArgumentType.TWO_IMMEDIATES];
    const expectedResult = {
      noOfBytesToSkip: code.length,
      type: ArgumentType.TWO_IMMEDIATES,

      firstImmediateDecoder: expectedfirstImmediateDecoder,
      secondImmediateDecoder: expectedsecondImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 2 immediates (2 instructions)", () => {
    const code = new Uint8Array([Instruction.STORE_IMM_U8, 1, 1, 2, Instruction.STORE_IMM_U8, 1, 1, 2]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0001_0001]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const expectedfirstImmediateDecoder = new ImmediateDecoder();
    expectedfirstImmediateDecoder.setBytes(new Uint8Array([0x01]));
    const expectedsecondImmediateDecoder = new ImmediateDecoder();
    expectedsecondImmediateDecoder.setBytes(new Uint8Array([0x02]));
    const result = createResults()[ArgumentType.TWO_IMMEDIATES];
    const expectedResult = {
      noOfBytesToSkip: code.length / 2,
      type: ArgumentType.TWO_IMMEDIATES,

      firstImmediateDecoder: expectedfirstImmediateDecoder,
      secondImmediateDecoder: expectedsecondImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 1 reg and 2 immediates", () => {
    const code = new Uint8Array([Instruction.STORE_IMM_IND_U8, 0x27, 1, 2, 3, 4]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0001]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const expectedfirstImmediateDecoder = new ImmediateDecoder();
    expectedfirstImmediateDecoder.setBytes(new Uint8Array([0x01, 0x02]));
    const expectedsecondImmediateDecoder = new ImmediateDecoder();
    expectedsecondImmediateDecoder.setBytes(new Uint8Array([0x03, 0x04]));
    const result = createResults()[ArgumentType.ONE_REGISTER_TWO_IMMEDIATES];
    const expectedResult = {
      noOfBytesToSkip: code.length,
      type: ArgumentType.ONE_REGISTER_TWO_IMMEDIATES,

      registerIndex: 7,

      firstImmediateDecoder: expectedfirstImmediateDecoder,
      secondImmediateDecoder: expectedsecondImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 1 reg and 2 immediates (2 instructions)", () => {
    const code = new Uint8Array([
      Instruction.STORE_IMM_IND_U8,
      0x27,
      1,
      2,
      3,
      4,
      Instruction.STORE_IMM_IND_U8,
      0x27,
      1,
      2,
      3,
      4,
    ]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0100_0001, 0b0000_0000]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const expectedfirstImmediateDecoder = new ImmediateDecoder();
    expectedfirstImmediateDecoder.setBytes(new Uint8Array([0x01, 0x02]));
    const expectedsecondImmediateDecoder = new ImmediateDecoder();
    expectedsecondImmediateDecoder.setBytes(new Uint8Array([0x03, 0x04]));
    const result = createResults()[ArgumentType.ONE_REGISTER_TWO_IMMEDIATES];
    const expectedResult = {
      noOfBytesToSkip: code.length / 2,
      type: ArgumentType.ONE_REGISTER_TWO_IMMEDIATES,

      registerIndex: 7,

      firstImmediateDecoder: expectedfirstImmediateDecoder,
      secondImmediateDecoder: expectedsecondImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 2 regs and 2 immediates", () => {
    const code = new Uint8Array([Instruction.LOAD_IMM_JUMP_IND, 135, 2, 1, 2, 3, 4]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b0000_0001]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const expectedfirstImmediateDecoder = new ImmediateDecoder();
    expectedfirstImmediateDecoder.setBytes(new Uint8Array([0x01, 0x02]));
    const expectedsecondImmediateDecoder = new ImmediateDecoder();
    expectedsecondImmediateDecoder.setBytes(new Uint8Array([0x03, 0x04]));
    const result = createResults()[ArgumentType.TWO_REGISTERS_TWO_IMMEDIATES];
    const expectedResult = {
      noOfBytesToSkip: code.length,
      type: ArgumentType.TWO_REGISTERS_TWO_IMMEDIATES,

      firstRegisterIndex: 7,
      secondRegisterIndex: 8,

      firstImmediateDecoder: expectedfirstImmediateDecoder,
      secondImmediateDecoder: expectedsecondImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("return correct result for instruction with 2 regs and 2 immediates (2 instructions)", () => {
    const code = new Uint8Array([
      Instruction.LOAD_IMM_JUMP_IND,
      135,
      2,
      1,
      2,
      3,
      4,
      Instruction.LOAD_IMM_JUMP_IND,
      135,
      2,
      1,
      2,
      3,
      4,
    ]);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array([0b1000_0001, 0b0000_0000]), code.length));
    const argsDecoder = new ArgsDecoder(code, mask);
    const expectedfirstImmediateDecoder = new ImmediateDecoder();
    expectedfirstImmediateDecoder.setBytes(new Uint8Array([0x01, 0x02]));
    const expectedsecondImmediateDecoder = new ImmediateDecoder();
    expectedsecondImmediateDecoder.setBytes(new Uint8Array([0x03, 0x04]));
    const result = createResults()[ArgumentType.TWO_REGISTERS_TWO_IMMEDIATES];
    const expectedResult = {
      noOfBytesToSkip: code.length / 2,
      type: ArgumentType.TWO_REGISTERS_TWO_IMMEDIATES,

      firstRegisterIndex: 7,
      secondRegisterIndex: 8,

      firstImmediateDecoder: expectedfirstImmediateDecoder,
      secondImmediateDecoder: expectedsecondImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });
});
