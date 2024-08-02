import type { Instruction } from "../instruction";
import type { Mask } from "../program-decoder/mask";
import { createResults } from "./args-decoding-results";
import { ArgumentType } from "./argument-type";
import { ImmediateDecoder } from "./decoders/immediate-decoder";
import { NibblesDecoder } from "./decoders/nibbles-decoder";
import { instructionArgumentTypeMap } from "./instruction-argument-type-map";

export type NoArgumentsResult = {
  type: ArgumentType.NO_ARGUMENTS;
  noOfBytesToSkip: number;
};

export type ThreeRegistersResult = {
  type: ArgumentType.THREE_REGISTERS;
  noOfBytesToSkip: number;
  firstRegisterIndex: number;
  secondRegisterIndex: number;
  thirdRegisterIndex: number;
};

export type TwoRegistersResult = {
  type: ArgumentType.TWO_REGISTERS;
  noOfBytesToSkip: number;
  firstRegisterIndex: number;
  secondRegisterIndex: number;
};

export type TwoRegistersOneImmediateResult = {
  type: ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE;
  noOfBytesToSkip: number;
  firstRegisterIndex: number;
  secondRegisterIndex: number;
  immediateDecoder: ImmediateDecoder;
};

export type OneRegisterOneImmediateResult = {
  type: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE;
  noOfBytesToSkip: number;
  firstRegisterIndex: number;
  immediateDecoder: ImmediateDecoder;
};

export type TwoRegistersTwoImmediatesResult = {
  type: ArgumentType.TWO_REGISTERS_TWO_IMMEDIATES;
  noOfBytesToSkip: number;
  firstRegisterIndex: number;
  secondRegisterIndex: number;
  firstImmediateDecoder: ImmediateDecoder;
  secondImmediateDecoder: ImmediateDecoder;
};

export type TwoImmediatesResult = {
  type: ArgumentType.TWO_IMMEDIATES;
  noOfBytesToSkip: number;
  firstImmediateDecoder: ImmediateDecoder;
  secondImmediateDecoder: ImmediateDecoder;
};

export type TwoRegistersOneOffsetResult = {
  type: ArgumentType.TWO_REGISTERS_ONE_OFFSET;
  noOfBytesToSkip: number;
  firstRegisterIndex: number;
  secondRegisterIndex: number;
  offset: number;
};

export type OneRegisterOneImmediateOneOffsetResult = {
  type: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET;
  noOfBytesToSkip: number;
  firstRegisterIndex: number;
  immediateDecoder: ImmediateDecoder;
  offset: number;
};

export type OneRegisterTwoImmediatesResult = {
  type: ArgumentType.ONE_REGISTER_TWO_IMMEDIATES;
  noOfBytesToSkip: number;
  registerIndex: number;
  firstImmediateDecoder: ImmediateDecoder;
  secondImmediateDecoder: ImmediateDecoder;
};

export type OneOffsetResult = {
  type: ArgumentType.ONE_OFFSET;
  noOfInstructionsToSkip: number;
  offset: number;
};

type Result =
  | NoArgumentsResult
  | TwoRegistersResult
  | ThreeRegistersResult
  | TwoRegistersOneImmediateResult
  | TwoRegistersTwoImmediatesResult
  | OneRegisterOneImmediateOneOffsetResult
  | TwoRegistersOneOffsetResult
  | OneRegisterOneImmediateResult
  | OneOffsetResult
  | TwoImmediatesResult
  | OneRegisterTwoImmediatesResult;

export class ArgsDecoder {
  private nibblesDecoder = new NibblesDecoder();
  private offsetDecoder = new ImmediateDecoder();

  private results = createResults(); // [MaSi] because I don't want to allocate memory for each instruction

  constructor(
    private code: Uint8Array,
    private mask: Mask,
  ) {}

  getArgs(pc: number): Result {
    const instruction: Instruction = this.code[pc];
    const argsType = instructionArgumentTypeMap[instruction];

    switch (argsType) {
      case ArgumentType.NO_ARGUMENTS:
        return this.results[argsType];

      case ArgumentType.THREE_REGISTERS: {
        const result = this.results[argsType];
        result.noOfBytesToSkip = 3;
        const firstByte = this.code[pc + 1];
        const secondByte = this.code[pc + 2];
        this.nibblesDecoder.setByte(firstByte);
        result.firstRegisterIndex = this.nibblesDecoder.getHighNibbleAsRegisterIndex();
        result.secondRegisterIndex = this.nibblesDecoder.getLowNibbleAsRegisterIndex();
        this.nibblesDecoder.setByte(secondByte);
        result.thirdRegisterIndex = this.nibblesDecoder.getLowNibble();
        return result;
      }

      case ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE: {
        const result = this.results[argsType];
        const firstByte = this.code[pc + 1];
        this.nibblesDecoder.setByte(firstByte);
        result.firstRegisterIndex = this.nibblesDecoder.getHighNibbleAsRegisterIndex();
        result.secondRegisterIndex = this.nibblesDecoder.getLowNibbleAsRegisterIndex();

        const immediateLength = this.mask.getNoOfBytesToNextInstruction(pc + 2);
        result.noOfBytesToSkip = 2 + immediateLength;

        result.immediateDecoder.setBytes(this.code.subarray(pc + 2, pc + 2 + immediateLength));
        return result;
      }

      case ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET: {
        const result = this.results[argsType];
        const firstByte = this.code[pc + 1];
        this.nibblesDecoder.setByte(firstByte);
        result.firstRegisterIndex = this.nibblesDecoder.getLowNibbleAsRegisterIndex();
        const immediateLength = this.nibblesDecoder.getHighNibble();
        result.immediateDecoder.setBytes(this.code.subarray(pc + 2, pc + 2 + immediateLength));
        const offsetLength = this.mask.getNoOfBytesToNextInstruction(pc + 2 + immediateLength);
        this.offsetDecoder.setBytes(
          this.code.subarray(pc + 2 + immediateLength, pc + 2 + immediateLength + offsetLength),
        );
        result.offset = this.offsetDecoder.getSigned();
        result.noOfBytesToSkip = 2 + immediateLength + offsetLength;
        return result;
      }

      case ArgumentType.TWO_REGISTERS_ONE_OFFSET: {
        const result = this.results[argsType];
        const firstByte = this.code[pc + 1];
        this.nibblesDecoder.setByte(firstByte);
        result.firstRegisterIndex = this.nibblesDecoder.getLowNibbleAsRegisterIndex();
        result.secondRegisterIndex = this.nibblesDecoder.getHighNibbleAsRegisterIndex();
        const offsetLength = this.mask.getNoOfBytesToNextInstruction(pc + 2);
        result.noOfBytesToSkip = 2 + offsetLength;

        this.offsetDecoder.setBytes(this.code.subarray(pc + 2, pc + 2 + offsetLength));
        result.offset = this.offsetDecoder.getSigned();
        return result;
      }

      case ArgumentType.TWO_REGISTERS: {
        const result = this.results[argsType];
        result.noOfBytesToSkip = 2;
        const firstByte = this.code[pc + 1];
        this.nibblesDecoder.setByte(firstByte);
        result.firstRegisterIndex = this.nibblesDecoder.getHighNibbleAsRegisterIndex();
        result.secondRegisterIndex = this.nibblesDecoder.getLowNibbleAsRegisterIndex();
        return result;
      }

      case ArgumentType.ONE_OFFSET: {
        const result = this.results[argsType];
        const offsetLength = this.mask.getNoOfBytesToNextInstruction(pc + 1);
        result.noOfInstructionsToSkip = 1 + offsetLength;
        this.offsetDecoder.setBytes(this.code.subarray(pc + 1, pc + 1 + offsetLength));
        result.offset = this.offsetDecoder.getSigned();
        return result;
      }

      case ArgumentType.ONE_REGISTER_ONE_IMMEDIATE: {
        const result = this.results[argsType];
        const firstByte = this.code[pc + 1];
        this.nibblesDecoder.setByte(firstByte);
        result.firstRegisterIndex = this.nibblesDecoder.getLowNibbleAsRegisterIndex();

        const immediateLength = this.mask.getNoOfBytesToNextInstruction(pc + 2);
        result.noOfBytesToSkip = 2 + immediateLength;

        result.immediateDecoder.setBytes(this.code.subarray(pc + 2, pc + 2 + immediateLength));
        return result;
      }

      case ArgumentType.TWO_IMMEDIATES: {
        const result = this.results[argsType];
        const firstByte = this.code[pc + 1];
        this.nibblesDecoder.setByte(firstByte);
        const firstImmediateLength = this.nibblesDecoder.getLowNibbleAsLength();
        result.firstImmediateDecoder.setBytes(this.code.subarray(pc + 2, pc + 2 + firstImmediateLength));
        const secondImmediateLength = this.mask.getNoOfBytesToNextInstruction(pc + 2 + firstImmediateLength);
        result.secondImmediateDecoder.setBytes(
          this.code.subarray(pc + 2 + firstImmediateLength, pc + 2 + firstImmediateLength + secondImmediateLength),
        );
        result.noOfBytesToSkip = 2 + firstImmediateLength + secondImmediateLength;
        return result;
      }

      case ArgumentType.ONE_REGISTER_TWO_IMMEDIATES: {
        const result = this.results[argsType];
        const firstByte = this.code[pc + 1];
        this.nibblesDecoder.setByte(firstByte);
        result.registerIndex = this.nibblesDecoder.getLowNibbleAsRegisterIndex();
        const firstImmediateLength = this.nibblesDecoder.getHighNibbleAsLength();
        result.firstImmediateDecoder.setBytes(this.code.subarray(pc + 2, pc + 2 + firstImmediateLength));
        const secondImmediateLength = this.mask.getNoOfBytesToNextInstruction(pc + 2 + firstImmediateLength);
        result.secondImmediateDecoder.setBytes(
          this.code.subarray(pc + 2 + firstImmediateLength, pc + 2 + firstImmediateLength + secondImmediateLength),
        );
        result.noOfBytesToSkip = 2 + firstImmediateLength + secondImmediateLength;
        return result;
      }

      case ArgumentType.TWO_REGISTERS_TWO_IMMEDIATES: {
        const result = this.results[argsType];
        let newPc = pc + 1;
        const firstByte = this.code[newPc];
        newPc += 1;
        const secondByte = this.code[newPc];
        this.nibblesDecoder.setByte(firstByte);
        result.firstRegisterIndex = this.nibblesDecoder.getLowNibbleAsRegisterIndex();
        result.secondRegisterIndex = this.nibblesDecoder.getHighNibbleAsRegisterIndex();
        this.nibblesDecoder.setByte(secondByte);
        const firstImmediateLength = this.nibblesDecoder.getLowNibbleAsLength();
        newPc += 1;
        result.firstImmediateDecoder.setBytes(this.code.subarray(newPc, newPc + firstImmediateLength));
        newPc += firstImmediateLength;
        const secondImmediateLength = this.mask.getNoOfBytesToNextInstruction(newPc);
        result.secondImmediateDecoder.setBytes(this.code.subarray(newPc, newPc + secondImmediateLength));
        newPc += secondImmediateLength;
        // BTW this name is not precise, it should be: noOfOctetsToSkip or noOfBytesToSkip
        result.noOfBytesToSkip = newPc - pc;
        return result;
      }

      default:
        throw new Error("instruction was not matched!");
    }
  }
}
