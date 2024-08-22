import type { Mask } from "../program-decoder/mask";
import { ArgumentType } from "./argument-type";
import { ImmediateDecoder } from "./decoders/immediate-decoder";
import { NibblesDecoder } from "./decoders/nibbles-decoder";

export type EmptyArgs = {
  type: ArgumentType.NO_ARGUMENTS;
  noOfBytesToSkip: number;
};

export type OneImmediateArgs = {
  type: ArgumentType.ONE_IMMEDIATE;
  noOfBytesToSkip: number;
  immediateDecoder: ImmediateDecoder;
};

export type ThreeRegistersArgs = {
  type: ArgumentType.THREE_REGISTERS;
  noOfBytesToSkip: number;
  firstRegisterIndex: number;
  secondRegisterIndex: number;
  thirdRegisterIndex: number;
};

export type TwoRegistersArgs = {
  type: ArgumentType.TWO_REGISTERS;
  noOfBytesToSkip: number;
  firstRegisterIndex: number;
  secondRegisterIndex: number;
};

export type TwoRegistersOneImmediateArgs = {
  type: ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE;
  noOfBytesToSkip: number;
  firstRegisterIndex: number;
  secondRegisterIndex: number;
  immediateDecoder: ImmediateDecoder;
};

export type OneRegisterOneImmediateArgs = {
  type: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE;
  noOfBytesToSkip: number;
  registerIndex: number;
  immediateDecoder: ImmediateDecoder;
};

export type TwoRegistersTwoImmediatesArgs = {
  type: ArgumentType.TWO_REGISTERS_TWO_IMMEDIATES;
  noOfBytesToSkip: number;
  firstRegisterIndex: number;
  secondRegisterIndex: number;
  firstImmediateDecoder: ImmediateDecoder;
  secondImmediateDecoder: ImmediateDecoder;
};

export type TwoImmediatesArgs = {
  type: ArgumentType.TWO_IMMEDIATES;
  noOfBytesToSkip: number;
  firstImmediateDecoder: ImmediateDecoder;
  secondImmediateDecoder: ImmediateDecoder;
};

export type TwoRegistersOneOffsetArgs = {
  type: ArgumentType.TWO_REGISTERS_ONE_OFFSET;
  noOfBytesToSkip: number;
  firstRegisterIndex: number;
  secondRegisterIndex: number;
  nextPc: number;
};

export type OneRegisterOneImmediateOneOffsetArgs = {
  type: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET;
  noOfBytesToSkip: number;
  registerIndex: number;
  immediateDecoder: ImmediateDecoder;
  nextPc: number;
};

export type OneRegisterTwoImmediatesArgs = {
  type: ArgumentType.ONE_REGISTER_TWO_IMMEDIATES;
  noOfBytesToSkip: number;
  registerIndex: number;
  firstImmediateDecoder: ImmediateDecoder;
  secondImmediateDecoder: ImmediateDecoder;
};

export type OneOffsetArgs = {
  type: ArgumentType.ONE_OFFSET;
  noOfBytesToSkip: number;
  nextPc: number;
};

type Args =
  | EmptyArgs
  | OneImmediateArgs
  | TwoRegistersArgs
  | ThreeRegistersArgs
  | TwoRegistersOneImmediateArgs
  | TwoRegistersTwoImmediatesArgs
  | OneRegisterOneImmediateOneOffsetArgs
  | TwoRegistersOneOffsetArgs
  | OneRegisterOneImmediateArgs
  | OneOffsetArgs
  | TwoImmediatesArgs
  | OneRegisterTwoImmediatesArgs;

export class ArgsDecoder {
  private nibblesDecoder = new NibblesDecoder();
  private offsetDecoder = new ImmediateDecoder();

  constructor(
    private code: Uint8Array,
    private mask: Mask,
  ) {}

  fillArgs<T extends Args>(pc: number, result: T): Args {
    switch (result.type) {
      case ArgumentType.NO_ARGUMENTS:
        return result;

      case ArgumentType.ONE_IMMEDIATE: {
        const immediateLength = this.mask.getNoOfBytesToNextInstruction(pc + 1);
        result.immediateDecoder.setBytes(this.code.subarray(pc + 1, pc + 1 + immediateLength));
        result.noOfBytesToSkip = 1 + immediateLength;
        return result;
      }

      case ArgumentType.THREE_REGISTERS: {
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
        const firstByte = this.code[pc + 1];
        this.nibblesDecoder.setByte(firstByte);
        result.registerIndex = this.nibblesDecoder.getLowNibbleAsRegisterIndex();
        const immediateLength = this.nibblesDecoder.getHighNibbleAsLength();
        result.immediateDecoder.setBytes(this.code.subarray(pc + 2, pc + 2 + immediateLength));
        const offsetLength = this.mask.getNoOfBytesToNextInstruction(pc + 2 + immediateLength);
        this.offsetDecoder.setBytes(
          this.code.subarray(pc + 2 + immediateLength, pc + 2 + immediateLength + offsetLength),
        );
        result.nextPc = pc + this.offsetDecoder.getSigned();
        result.noOfBytesToSkip = 2 + immediateLength + offsetLength;
        return result;
      }

      case ArgumentType.TWO_REGISTERS_ONE_OFFSET: {
        const firstByte = this.code[pc + 1];
        this.nibblesDecoder.setByte(firstByte);
        result.firstRegisterIndex = this.nibblesDecoder.getLowNibbleAsRegisterIndex();
        result.secondRegisterIndex = this.nibblesDecoder.getHighNibbleAsRegisterIndex();
        const offsetLength = this.mask.getNoOfBytesToNextInstruction(pc + 2);
        result.noOfBytesToSkip = 2 + offsetLength;

        this.offsetDecoder.setBytes(this.code.subarray(pc + 2, pc + 2 + offsetLength));
        result.nextPc = pc + this.offsetDecoder.getSigned();
        return result;
      }

      case ArgumentType.TWO_REGISTERS: {
        result.noOfBytesToSkip = 2;
        const firstByte = this.code[pc + 1];
        this.nibblesDecoder.setByte(firstByte);
        result.firstRegisterIndex = this.nibblesDecoder.getHighNibbleAsRegisterIndex();
        result.secondRegisterIndex = this.nibblesDecoder.getLowNibbleAsRegisterIndex();
        return result;
      }

      case ArgumentType.ONE_OFFSET: {
        const offsetLength = this.mask.getNoOfBytesToNextInstruction(pc + 1);
        result.noOfBytesToSkip = 1 + offsetLength;
        this.offsetDecoder.setBytes(this.code.subarray(pc + 1, pc + 1 + offsetLength));
        result.nextPc = pc + this.offsetDecoder.getSigned();
        return result;
      }

      case ArgumentType.ONE_REGISTER_ONE_IMMEDIATE: {
        const firstByte = this.code[pc + 1];
        this.nibblesDecoder.setByte(firstByte);
        result.registerIndex = this.nibblesDecoder.getLowNibbleAsRegisterIndex();

        const immediateLength = this.mask.getNoOfBytesToNextInstruction(pc + 2);
        result.noOfBytesToSkip = 2 + immediateLength;

        result.immediateDecoder.setBytes(this.code.subarray(pc + 2, pc + 2 + immediateLength));
        return result;
      }

      case ArgumentType.TWO_IMMEDIATES: {
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
        result.noOfBytesToSkip = newPc - pc;
        return result;
      }
    }
  }
}
