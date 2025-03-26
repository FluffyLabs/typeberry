import assert from "node:assert";
import { describe, it } from "node:test";
import { BitVec } from "@typeberry/bytes";
import { Instruction } from "../instruction";
import { Mask } from "../program-decoder/mask";
import { ArgsDecoder } from "./args-decoder";
import { createResults } from "./args-decoding-results";
import { ArgumentType } from "./argument-type";
import { ExtendedWitdthImmediateDecoder } from "./decoders/extended-with-immediate-decoder";
import { ImmediateDecoder } from "./decoders/immediate-decoder";

describe("ArgsDecoder", () => {
  function prepareData({
    programBytes,
    maskBytes,
    argumentType,
  }: { programBytes: number[]; maskBytes: number[]; argumentType: ArgumentType }) {
    const code = new Uint8Array(programBytes);
    const mask = new Mask(BitVec.fromBlob(new Uint8Array(maskBytes), programBytes.length));
    const argsDecoder = new ArgsDecoder();
    argsDecoder.reset(code, mask);
    const result = createResults()[argumentType];

    return { argsDecoder, result, argumentType };
  }

  function prepareImmediate(bytes: number[]) {
    const immediate = new ImmediateDecoder();
    immediate.setBytes(new Uint8Array(bytes));
    return immediate;
  }

  function prepareExtendedWidthImmediate(bytes: number[]) {
    const immediate = new ExtendedWitdthImmediateDecoder();
    immediate.setBytes(new Uint8Array(bytes));
    return immediate;
  }

  it("should return empty result for instruction without args", () => {
    const programBytes = [Instruction.TRAP];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.NO_ARGUMENTS,
    });
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return empty result for instruction without args (2 instructions)", () => {
    const programBytes = [Instruction.TRAP, Instruction.TRAP];
    const maskBytes = [0b0000_0011];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.NO_ARGUMENTS,
    });

    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 immediate", () => {
    const programBytes = [Instruction.ECALLI, 0xff];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_IMMEDIATE,
    });
    const expectedImmediateDecoder = prepareImmediate([0xff]);
    const expectedResult = {
      noOfBytesToSkip: 2,
      type: argumentType,
      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 immediate (no args, last instruction)", () => {
    const programBytes = [Instruction.ECALLI];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_IMMEDIATE,
    });
    const expectedImmediateDecoder = prepareImmediate([0]);
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,
      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 immediate (2 instructions)", () => {
    const programBytes = [Instruction.ECALLI, 0xff, Instruction.ECALLI, 0xff];
    const maskBytes = [0b0000_0101];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_IMMEDIATE,
    });
    const expectedImmediateDecoder = prepareImmediate([0xff]);
    const expectedResult = {
      noOfBytesToSkip: 2,
      type: argumentType,
      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 immediate (2 instructions, no args, no last instruction)", () => {
    const programBytes = [Instruction.ECALLI, Instruction.ECALLI, 0xff];
    const maskBytes = [0b0000_0011];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_IMMEDIATE,
    });
    const expectedImmediateDecoder = prepareImmediate([0]);
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,
      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 3 regs", () => {
    const programBytes = [Instruction.ADD_32, 0x12, 0x03];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.THREE_REGISTERS,
    });

    const expectedResult = {
      noOfBytesToSkip: 3,
      type: argumentType,

      firstRegisterIndex: 2,
      secondRegisterIndex: 1,
      thirdRegisterIndex: 3,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 3 regs (no args, last instruction)", () => {
    const programBytes = [Instruction.ADD_32];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.THREE_REGISTERS,
    });

    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      firstRegisterIndex: 0,
      secondRegisterIndex: 0,
      thirdRegisterIndex: 0,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 3 regs (2 instructions)", () => {
    const programBytes = [Instruction.ADD_32, 0x12, 0x03, Instruction.ADD_32, 0x12, 0x03];
    const maskBytes = [0b0000_1001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.THREE_REGISTERS,
    });

    const expectedResult = {
      noOfBytesToSkip: 3,
      type: argumentType,

      firstRegisterIndex: 2,
      secondRegisterIndex: 1,
      thirdRegisterIndex: 3,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 3 regs (2 instructions, no args, no last instruction)", () => {
    const programBytes = [Instruction.ADD_32, Instruction.ADD_32, 0x12, 0x03];
    const maskBytes = [0b0000_0011];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.THREE_REGISTERS,
    });

    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      firstRegisterIndex: 12,
      secondRegisterIndex: 11,
      thirdRegisterIndex: 2,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 regs and 1 immediate", () => {
    const programBytes = [Instruction.ADD_IMM_32, 0x12, 0xff];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE,
    });

    const expectedImmediateDecoder = prepareImmediate([0xff]);
    const expectedResult = {
      noOfBytesToSkip: 3,
      type: argumentType,

      firstRegisterIndex: 2,
      secondRegisterIndex: 1,

      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 regs and 1 immediate (no args, last instrction)", () => {
    const programBytes = [Instruction.ADD_IMM_32];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE,
    });

    const expectedImmediateDecoder = prepareImmediate([0]);
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      firstRegisterIndex: 0,
      secondRegisterIndex: 0,

      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 regs and 1 immediate (2 instructions)", () => {
    const programBytes = [Instruction.ADD_IMM_32, 0x12, 0xff, Instruction.ADD_IMM_32, 0x12, 0xff];
    const maskBytes = [0b0000_1001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE,
    });

    const expectedImmediateDecoder = prepareImmediate([0xff]);
    const expectedResult = {
      noOfBytesToSkip: 3,
      type: argumentType,

      firstRegisterIndex: 2,
      secondRegisterIndex: 1,

      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 regs and 1 immediate (2 instructions, no args, no last instruction)", () => {
    const programBytes = [Instruction.ADD_IMM_32, Instruction.ADD_IMM_32, 0x12, 0xff];
    const maskBytes = [0b0000_0011];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE,
    });

    const expectedImmediateDecoder = prepareImmediate([0]);
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      firstRegisterIndex: 3,
      secondRegisterIndex: 8,

      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 reg, 1 immediate and 1 offset", () => {
    const programBytes = [Instruction.BRANCH_EQ_IMM, 39, 210, 4, 6];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET,
    });
    const expectedImmediateDecoder = prepareImmediate([210, 4]);
    const expectedResult = {
      noOfBytesToSkip: 5,
      type: argumentType,
      registerIndex: 7,
      immediateDecoder: expectedImmediateDecoder,
      nextPc: 6,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 reg, 1 immediate and 1 offset (no args, last instruction)", () => {
    const programBytes = [Instruction.BRANCH_EQ_IMM];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET,
    });
    const expectedImmediateDecoder = prepareImmediate([0]);
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,
      registerIndex: 0,
      immediateDecoder: expectedImmediateDecoder,
      nextPc: 0,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 reg, 1 immediate and 1 offset (2 instructions)", () => {
    const programBytes = [Instruction.BRANCH_EQ_IMM, 39, 210, 4, 6, Instruction.BRANCH_EQ_IMM, 39, 210, 4, 6];
    const maskBytes = [0b0010_0001, 0b0000_0000];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET,
    });
    const expectedImmediateDecoder = prepareImmediate([210, 4]);
    const expectedResult = {
      noOfBytesToSkip: 5,
      type: argumentType,
      registerIndex: 7,
      immediateDecoder: expectedImmediateDecoder,
      nextPc: 6,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 reg, 1 immediate and 1 offset (2 instructions, no args, no last instruction)", () => {
    const programBytes = [Instruction.BRANCH_EQ_IMM, Instruction.BRANCH_EQ_IMM, 39, 210, 4, 6];
    const maskBytes = [0b0000_0011, 0b0000_0000];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET,
    });
    const expectedImmediateDecoder = prepareImmediate([39, 210, 4, 6]);
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,
      registerIndex: 1,
      immediateDecoder: expectedImmediateDecoder,
      nextPc: 0,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 regs and 1 offset", () => {
    const programBytes = [Instruction.BRANCH_EQ, 135, 4];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_REGISTERS_ONE_OFFSET,
    });
    const expectedResult = {
      noOfBytesToSkip: 3,
      type: argumentType,

      firstRegisterIndex: 7,
      secondRegisterIndex: 8,

      nextPc: 4,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 regs and 1 offset (no args, last instruction)", () => {
    const programBytes = [Instruction.BRANCH_EQ];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_REGISTERS_ONE_OFFSET,
    });
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      firstRegisterIndex: 0,
      secondRegisterIndex: 0,

      nextPc: 0,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 regs and 1 offset (2 instructions)", () => {
    const programBytes = [Instruction.BRANCH_EQ, 135, 4, Instruction.BRANCH_EQ, 135, 4];
    const maskBytes = [0b0000_1001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_REGISTERS_ONE_OFFSET,
    });

    const expectedResult = {
      noOfBytesToSkip: 3,
      type: argumentType,

      firstRegisterIndex: 7,
      secondRegisterIndex: 8,

      nextPc: 4,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 regs and 1 offset (2 instructions, no args, no last instruction)", () => {
    const programBytes = [Instruction.BRANCH_EQ, Instruction.BRANCH_EQ, 135, 4];
    const maskBytes = [0b0000_0011];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_REGISTERS_ONE_OFFSET,
    });

    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      firstRegisterIndex: 10,
      secondRegisterIndex: 10,

      nextPc: 0,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 regs", () => {
    const programBytes = [Instruction.MOVE_REG, 0x12];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_REGISTERS,
    });
    const expectedResult = {
      noOfBytesToSkip: 2,
      type: argumentType,

      firstRegisterIndex: 1,
      secondRegisterIndex: 2,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 regs (no args, last instruction)", () => {
    const programBytes = [Instruction.MOVE_REG];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_REGISTERS,
    });
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      firstRegisterIndex: 0,
      secondRegisterIndex: 0,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 regs (2 instructions)", () => {
    const programBytes = [Instruction.MOVE_REG, 0x12, Instruction.MOVE_REG, 0x12];
    const maskBytes = [0b0000_0101];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_REGISTERS,
    });
    const expectedResult = {
      noOfBytesToSkip: 2,
      type: argumentType,

      firstRegisterIndex: 1,
      secondRegisterIndex: 2,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 regs (2 instructions, no args, no last instruction)", () => {
    const programBytes = [Instruction.MOVE_REG, Instruction.MOVE_REG, 0x12];
    const maskBytes = [0b0000_0011];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_REGISTERS,
    });
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      firstRegisterIndex: 6,
      secondRegisterIndex: 4,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 offset", () => {
    const programBytes = [Instruction.JUMP, 4];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_OFFSET,
    });

    const expectedResult = {
      noOfBytesToSkip: 2,
      type: argumentType,

      nextPc: 4,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 offset (no args, last instruction)", () => {
    const programBytes = [Instruction.JUMP];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_OFFSET,
    });

    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      nextPc: 0,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 offset (2 instructions)", () => {
    const programBytes = [Instruction.JUMP, 4, Instruction.JUMP, 4];
    const maskBytes = [0b0000_0101];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_OFFSET,
    });
    const expectedResult = {
      noOfBytesToSkip: 2,
      type: argumentType,

      nextPc: 4,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 offset (2 instructions, no args, no last instruction)", () => {
    const programBytes = [Instruction.JUMP, Instruction.JUMP, 4];
    const maskBytes = [0b0000_0011];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_OFFSET,
    });
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      nextPc: 0,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 reg and 1 immediate", () => {
    const programBytes = [Instruction.LOAD_IMM, 0x02, 0xff];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE,
    });
    const expectedImmediateDecoder = prepareImmediate([0xff]);
    const expectedResult = {
      noOfBytesToSkip: 3,
      type: argumentType,

      registerIndex: 2,

      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 reg and 1 immediate (no args, last instruction)", () => {
    const programBytes = [Instruction.LOAD_IMM];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE,
    });
    const expectedImmediateDecoder = prepareImmediate([0]);
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      registerIndex: 0,

      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 reg and 1 immediate (2 instructions)", () => {
    const programBytes = [Instruction.LOAD_IMM, 0x02, 0xff, Instruction.LOAD_IMM, 0x02, 0xff];
    const maskBytes = [0b0000_1001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE,
    });
    const expectedImmediateDecoder = prepareImmediate([0xff]);
    const expectedResult = {
      noOfBytesToSkip: 3,
      type: argumentType,

      registerIndex: 2,

      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 reg and 1 immediate (2 instructions, no args, no last instruction)", () => {
    const programBytes = [Instruction.LOAD_IMM, Instruction.LOAD_IMM, 0x02, 0xff];
    const maskBytes = [0b0000_0011];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE,
    });
    const expectedImmediateDecoder = prepareImmediate([0]);
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      registerIndex: 3,

      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 immediates", () => {
    const programBytes = [Instruction.STORE_IMM_U8, 1, 1, 2];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_IMMEDIATES,
    });
    const expectedfirstImmediateDecoder = prepareImmediate([0x01]);
    const expectedSecondImmediateDecoder = prepareImmediate([0x02]);
    const expectedResult = {
      noOfBytesToSkip: 4,
      type: argumentType,

      firstImmediateDecoder: expectedfirstImmediateDecoder,
      secondImmediateDecoder: expectedSecondImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 immediates (no args, last instruction)", () => {
    const programBytes = [Instruction.STORE_IMM_U8];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_IMMEDIATES,
    });
    const expectedfirstImmediateDecoder = prepareImmediate([0]);
    const expectedSecondImmediateDecoder = prepareImmediate([0]);
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      firstImmediateDecoder: expectedfirstImmediateDecoder,
      secondImmediateDecoder: expectedSecondImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 immediates (2 instructions)", () => {
    const programBytes = [Instruction.STORE_IMM_U8, 1, 1, 2, Instruction.STORE_IMM_U8, 1, 1, 2];
    const maskBytes = [0b0001_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_IMMEDIATES,
    });
    const expectedfirstImmediateDecoder = prepareImmediate([0x01]);
    const expectedSecondImmediateDecoder = prepareImmediate([0x02]);
    const expectedResult = {
      noOfBytesToSkip: 4,
      type: argumentType,

      firstImmediateDecoder: expectedfirstImmediateDecoder,
      secondImmediateDecoder: expectedSecondImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 immediates (2 instructions, no args, no last instruction)", () => {
    const programBytes = [Instruction.STORE_IMM_U8, Instruction.STORE_IMM_U8, 1, 1, 2];
    const maskBytes = [0b0000_0011];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_IMMEDIATES,
    });
    const expectedfirstImmediateDecoder = prepareImmediate([1, 1, 2]);
    const expectedSecondImmediateDecoder = prepareImmediate([0]);
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      firstImmediateDecoder: expectedfirstImmediateDecoder,
      secondImmediateDecoder: expectedSecondImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 reg and 2 immediates", () => {
    const programBytes = [Instruction.STORE_IMM_IND_U8, 0x27, 1, 2, 3, 4];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_REGISTER_TWO_IMMEDIATES,
    });
    const expectedfirstImmediateDecoder = prepareImmediate([0x01, 0x02]);
    const expectedSecondImmediateDecoder = prepareImmediate([0x03, 0x04]);
    const expectedResult = {
      noOfBytesToSkip: 6,
      type: argumentType,

      registerIndex: 7,

      firstImmediateDecoder: expectedfirstImmediateDecoder,
      secondImmediateDecoder: expectedSecondImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 reg and 2 immediates (no args, last instruction)", () => {
    const programBytes = [Instruction.STORE_IMM_IND_U8];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_REGISTER_TWO_IMMEDIATES,
    });
    const expectedfirstImmediateDecoder = prepareImmediate([0]);
    const expectedSecondImmediateDecoder = prepareImmediate([0]);
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      registerIndex: 0,

      firstImmediateDecoder: expectedfirstImmediateDecoder,
      secondImmediateDecoder: expectedSecondImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 reg and 2 immediates (2 instructions)", () => {
    const programBytes = [
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
    ];
    const maskBytes = [0b0100_0001, 0b0000_0000];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_REGISTER_TWO_IMMEDIATES,
    });
    const expectedfirstImmediateDecoder = prepareImmediate([0x01, 0x02]);
    const expectedSecondImmediateDecoder = prepareImmediate([0x03, 0x04]);
    const expectedResult = {
      noOfBytesToSkip: 6,
      type: argumentType,

      registerIndex: 7,

      firstImmediateDecoder: expectedfirstImmediateDecoder,
      secondImmediateDecoder: expectedSecondImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 reg and 2 immediates (2 instructions, no args, no last instruction)", () => {
    const programBytes = [Instruction.STORE_IMM_IND_U8, Instruction.STORE_IMM_IND_U8, 0x27, 1, 2, 3, 4];
    const maskBytes = [0b0000_0011];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_REGISTER_TWO_IMMEDIATES,
    });
    const expectedfirstImmediateDecoder = prepareImmediate([0x27, 1, 2, 3]);
    const expectedSecondImmediateDecoder = prepareImmediate([0]);
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      registerIndex: 6,

      firstImmediateDecoder: expectedfirstImmediateDecoder,
      secondImmediateDecoder: expectedSecondImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 regs and 2 immediates", () => {
    const programBytes = [Instruction.LOAD_IMM_JUMP_IND, 135, 2, 1, 2, 3, 4];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_REGISTERS_TWO_IMMEDIATES,
    });
    const expectedfirstImmediateDecoder = prepareImmediate([0x01, 0x02]);
    const expectedSecondImmediateDecoder = prepareImmediate([0x03, 0x04]);
    const expectedResult = {
      noOfBytesToSkip: 7,
      type: argumentType,

      firstRegisterIndex: 7,
      secondRegisterIndex: 8,

      firstImmediateDecoder: expectedfirstImmediateDecoder,
      secondImmediateDecoder: expectedSecondImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 regs and 2 immediates (no args, last instruction)", () => {
    const programBytes = [Instruction.LOAD_IMM_JUMP_IND];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_REGISTERS_TWO_IMMEDIATES,
    });
    const expectedfirstImmediateDecoder = prepareImmediate([0]);
    const expectedSecondImmediateDecoder = prepareImmediate([0]);
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      firstRegisterIndex: 0,
      secondRegisterIndex: 0,

      firstImmediateDecoder: expectedfirstImmediateDecoder,
      secondImmediateDecoder: expectedSecondImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 regs and 2 immediates (2 instructions)", () => {
    const programBytes = [
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
    ];
    const maskBytes = [0b1000_0001, 0b0000_0000];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_REGISTERS_TWO_IMMEDIATES,
    });
    const expectedfirstImmediateDecoder = prepareImmediate([0x01, 0x02]);
    const expectedSecondImmediateDecoder = prepareImmediate([0x03, 0x04]);
    const expectedResult = {
      noOfBytesToSkip: 7,
      type: argumentType,

      firstRegisterIndex: 7,
      secondRegisterIndex: 8,

      firstImmediateDecoder: expectedfirstImmediateDecoder,
      secondImmediateDecoder: expectedSecondImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 2 regs and 2 immediates (2 instructions, no args, no last instruction)", () => {
    const programBytes = [Instruction.LOAD_IMM_JUMP_IND, Instruction.LOAD_IMM_JUMP_IND, 135, 2, 1, 2, 3, 4];
    const maskBytes = [0b0000_0011];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.TWO_REGISTERS_TWO_IMMEDIATES,
    });
    const expectedfirstImmediateDecoder = prepareImmediate([2, 1, 2, 3]);
    const expectedSecondImmediateDecoder = prepareImmediate([0]);
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      firstRegisterIndex: 4,
      secondRegisterIndex: 11,

      firstImmediateDecoder: expectedfirstImmediateDecoder,
      secondImmediateDecoder: expectedSecondImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 reg and 1 extended width immediate", () => {
    const programBytes = [Instruction.LOAD_IMM_64, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09];
    const maskBytes = [0b0000_0001, 0b0000_0000];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_REGISTER_ONE_EXTENDED_WIDTH_IMMEDIATE,
    });
    const expectedImmediateDecoder = prepareExtendedWidthImmediate([0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09]);
    const expectedResult = {
      noOfBytesToSkip: 10,
      type: argumentType,

      registerIndex: 1,

      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 reg and 1 extended width immediate (no args, last instruction)", () => {
    const programBytes = [Instruction.LOAD_IMM_64];
    const maskBytes = [0b0000_0001];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_REGISTER_ONE_EXTENDED_WIDTH_IMMEDIATE,
    });
    const expectedImmediateDecoder = prepareExtendedWidthImmediate([0x0]);
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      registerIndex: 0,

      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 reg and 1 extended width immediate (2 instructions)", () => {
    const programBytes = [
      Instruction.LOAD_IMM_64,
      0x01,
      0x02,
      0x03,
      0x04,
      0x05,
      0x06,
      0x07,
      0x08,
      0x09,
      Instruction.LOAD_IMM_64,
      0x01,
      0x02,
      0x03,
      0x04,
      0x05,
      0x06,
      0x07,
      0x08,
      0x09,
    ];
    const maskBytes = [0b0000_0001, 0b0000_0100, 0b0000_0000];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_REGISTER_ONE_EXTENDED_WIDTH_IMMEDIATE,
    });
    const expectedImmediateDecoder = prepareExtendedWidthImmediate([0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09]);
    const expectedResult = {
      noOfBytesToSkip: 10,
      type: argumentType,

      registerIndex: 1,

      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });

  it("should return correct result for instruction with 1 reg and 1 extended width immediate (2 instructions, no args, no last instruction)", () => {
    const programBytes = [
      Instruction.LOAD_IMM_64,
      Instruction.LOAD_IMM_64,
      0x01,
      0x02,
      0x03,
      0x04,
      0x05,
      0x06,
      0x07,
      0x08,
      0x09,
    ];
    const maskBytes = [0b0000_0011, 0b0000_0000];
    const { argsDecoder, result, argumentType } = prepareData({
      programBytes,
      maskBytes,
      argumentType: ArgumentType.ONE_REGISTER_ONE_EXTENDED_WIDTH_IMMEDIATE,
    });
    const expectedImmediateDecoder = prepareExtendedWidthImmediate([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
    const expectedResult = {
      noOfBytesToSkip: 1,
      type: argumentType,

      registerIndex: 4,

      immediateDecoder: expectedImmediateDecoder,
    };

    argsDecoder.fillArgs(0, result);

    assert.deepStrictEqual(result, expectedResult);
  });
});
