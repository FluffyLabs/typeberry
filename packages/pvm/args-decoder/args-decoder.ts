import type { Context } from "../context";
import type { Instruction } from "../instruction";
import { createResults } from "./args-decoding-results";
import { ArgumentType } from "./argument-type";
import { ImmediateDecoder } from "./decoders/immediate-decoder";
import { NibblesDecoder } from "./decoders/nibbles-decoder";
import { instructionArgumentTypeMap } from "./instruction-argument-type-map";

export type NoArgumentsResult = {
  type: ArgumentType.NO_ARGUMENTS;
  noOfInstructionsToSkip: number;
};

export type ThreeRegistersResult = {
  type: ArgumentType.THREE_REGISTERS;
  noOfInstructionsToSkip: number;
  firstRegisterIndex: number;
  secondRegisterIndex: number;
  thirdRegisterIndex: number;
};

export type TwoRegistersResult = {
  type: ArgumentType.TWO_REGISTERS;
  noOfInstructionsToSkip: number;
  firstRegisterIndex: number;
  secondRegisterIndex: number;
};

export type TwoRegistersOneImmediateResult = {
  type: ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE;
  noOfInstructionsToSkip: number;
  firstRegisterIndex: number;
  secondRegisterIndex: number;
  immediateDecoder1: ImmediateDecoder;
};

export type TwoRegistersTwoImmediatesResult = {
  type: ArgumentType.TWO_REGISTERS_TWO_IMMEDIATE;
  noOfInstructionsToSkip: number;
  firstRegisterIndex: number;
  secondRegisterIndex: number;
  immediateDecoder1: ImmediateDecoder;
  immediateDecoder2: ImmediateDecoder;
};

export type TwoRegistersOneOffsetResult = {
  type: ArgumentType.TWO_REGISTERS_ONE_OFFSET;
  noOfInstructionsToSkip: number;
  firstRegisterIndex: number;
  secondRegisterIndex: number;
  offset: number;
};

export type OneRegisterOneImmediateOneOffsetResult = {
  type: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET;
  noOfInstructionsToSkip: number;
  firstRegisterIndex: number;
  immediateDecoder1: ImmediateDecoder;
  offset: number;
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
  | OneOffsetResult;

export class ArgsDecoder {
  private registerIndexDecoder = new NibblesDecoder();
  private immediateDecoder1 = new ImmediateDecoder();
  private immediateDecoder2 = new ImmediateDecoder();

  private results = createResults(); // [MaSi] because I don't want to allocate memory for each instruction

  constructor(private context: Pick<Context, "code" | "mask">) {}

  getArgs(pc: number): Result {
    const instruction: Instruction = this.context.code[pc];
    const argsType = instructionArgumentTypeMap[instruction];

    switch (argsType) {
      case ArgumentType.NO_ARGUMENTS:
        return this.results[argsType];

      case ArgumentType.THREE_REGISTERS: {
        const result = this.results[argsType];
        result.noOfInstructionsToSkip = 3;
        const firstByte = this.context.code[pc + 1];
        const secondByte = this.context.code[pc + 2];
        this.registerIndexDecoder.setByte(firstByte);
        result.firstRegisterIndex = this.registerIndexDecoder.getHighNibbleAsRegisterIndex();
        result.secondRegisterIndex = this.registerIndexDecoder.getLowNibbleAsRegisterIndex();
        this.registerIndexDecoder.setByte(secondByte);
        result.thirdRegisterIndex = this.registerIndexDecoder.getLowNibble();
        return result;
      }

      case ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE: {
        const result = this.results[argsType];
        const firstByte = this.context.code[pc + 1];
        this.registerIndexDecoder.setByte(firstByte);
        result.firstRegisterIndex = this.registerIndexDecoder.getHighNibbleAsRegisterIndex();
        result.secondRegisterIndex = this.registerIndexDecoder.getLowNibbleAsRegisterIndex();

        const immediateLength = this.context.mask.getNoOfBytesToNextInstruction(pc + 2);
        result.noOfInstructionsToSkip = 2 + immediateLength;

        this.immediateDecoder1.setBytes(this.context.code.subarray(pc + 2, pc + 2 + immediateLength));
        result.immediateDecoder1 = this.immediateDecoder1;
        return result;
      }

      case ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET: {
        const result = this.results[argsType];
        const firstByte = this.context.code[pc + 1];
        this.registerIndexDecoder.setByte(firstByte);
        result.firstRegisterIndex = this.registerIndexDecoder.getLowNibbleAsRegisterIndex();
        const immediateLength = this.registerIndexDecoder.getHighNibble();
        this.immediateDecoder1.setBytes(this.context.code.subarray(pc + 2, pc + 2 + immediateLength));
        const offsetLength = this.context.mask.getNoOfBytesToNextInstruction(pc + 2 + immediateLength);
        this.immediateDecoder2.setBytes(
          this.context.code.subarray(pc + 2 + immediateLength, pc + 2 + immediateLength + offsetLength),
        );
        result.immediateDecoder1 = this.immediateDecoder1;
        result.offset = this.immediateDecoder2.getSigned();
        result.noOfInstructionsToSkip = 2 + immediateLength + offsetLength;
        return result;
      }

      case ArgumentType.TWO_REGISTERS_ONE_OFFSET: {
        const result = this.results[argsType];
        const firstByte = this.context.code[pc + 1];
        this.registerIndexDecoder.setByte(firstByte);
        result.firstRegisterIndex = this.registerIndexDecoder.getLowNibbleAsRegisterIndex();
        result.secondRegisterIndex = this.registerIndexDecoder.getHighNibbleAsRegisterIndex();
        const offsetLength = this.context.mask.getNoOfBytesToNextInstruction(pc + 2);
        result.noOfInstructionsToSkip = 2 + offsetLength;

        this.immediateDecoder1.setBytes(this.context.code.subarray(pc + 2, pc + 2 + offsetLength));
        result.offset = this.immediateDecoder1.getSigned();
        return result;
      }

      case ArgumentType.TWO_REGISTERS: {
        const result = this.results[argsType];
        result.noOfInstructionsToSkip = 2;
        const firstByte = this.context.code[pc + 1];
        this.registerIndexDecoder.setByte(firstByte);
        result.firstRegisterIndex = this.registerIndexDecoder.getHighNibbleAsRegisterIndex();
        result.secondRegisterIndex = this.registerIndexDecoder.getLowNibbleAsRegisterIndex();
        return result;
      }

      case ArgumentType.ONE_OFFSET: {
        const result = this.results[argsType];
        const offsetLength = this.context.mask.getNoOfBytesToNextInstruction(pc + 1);
        result.noOfInstructionsToSkip = 1 + offsetLength;
        this.immediateDecoder1.setBytes(this.context.code.subarray(pc + 1, pc + 1 + offsetLength));
        result.offset = this.immediateDecoder1.getSigned();
        return result;
      }

      default:
        throw new Error("instruction was not matched!");
    }
  }
}
