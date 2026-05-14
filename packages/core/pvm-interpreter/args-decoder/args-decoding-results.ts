import type {
  EmptyArgs,
  OneImmediateArgs,
  OneOffsetArgs,
  OneRegisterOneExtendedWidthImmediateArgs,
  OneRegisterOneImmediateArgs,
  OneRegisterOneImmediateOneOffsetArgs,
  OneRegisterTwoImmediatesArgs,
  ThreeRegistersArgs,
  TwoImmediatesArgs,
  TwoRegistersArgs,
  TwoRegistersOneImmediateArgs,
  TwoRegistersOneOffsetArgs,
  TwoRegistersTwoImmediatesArgs,
} from "./args-decoder.js";
import { ArgumentType } from "./argument-type.js";
import { ExtendedWitdthImmediateDecoder } from "./decoders/extended-with-immediate-decoder.js";
import { ImmediateDecoder } from "./decoders/immediate-decoder.js";

const ARGUMENT_TYPE_LENGTH = Object.keys(ArgumentType).length / 2;

type Results = [
  EmptyArgs,
  OneImmediateArgs,
  TwoImmediatesArgs,
  OneOffsetArgs,
  OneRegisterOneImmediateArgs,
  OneRegisterTwoImmediatesArgs,
  OneRegisterOneImmediateOneOffsetArgs,
  TwoRegistersArgs,
  TwoRegistersOneImmediateArgs,
  TwoRegistersOneOffsetArgs,
  TwoRegistersTwoImmediatesArgs,
  ThreeRegistersArgs,
  OneRegisterOneExtendedWidthImmediateArgs,
];

export const createResults = () => {
  const results = new Array(ARGUMENT_TYPE_LENGTH) as Results;

  results[ArgumentType.NO_ARGUMENTS] = {
    type: ArgumentType.NO_ARGUMENTS,
    noOfBytesToSkip: 1,
  };

  results[ArgumentType.ONE_IMMEDIATE] = {
    type: ArgumentType.ONE_IMMEDIATE,
    noOfBytesToSkip: 1,
    immediateDecoder: ImmediateDecoder.new(),
  };

  results[ArgumentType.TWO_REGISTERS] = {
    type: ArgumentType.TWO_REGISTERS,
    noOfBytesToSkip: 1,
    firstRegisterIndex: 0,
    secondRegisterIndex: 0,
  };

  results[ArgumentType.THREE_REGISTERS] = {
    type: ArgumentType.THREE_REGISTERS,
    noOfBytesToSkip: 1,
    firstRegisterIndex: 0,
    secondRegisterIndex: 0,
    thirdRegisterIndex: 0,
  };

  results[ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET] = {
    type: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET,
    noOfBytesToSkip: 1,
    registerIndex: 0,
    immediateDecoder: ImmediateDecoder.new(),
    nextPc: 0,
  };

  results[ArgumentType.TWO_REGISTERS_ONE_OFFSET] = {
    type: ArgumentType.TWO_REGISTERS_ONE_OFFSET,
    noOfBytesToSkip: 1,
    firstRegisterIndex: 0,
    secondRegisterIndex: 0,
    nextPc: 0,
  };

  results[ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE] = {
    type: ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE,
    noOfBytesToSkip: 1,
    firstRegisterIndex: 0,
    secondRegisterIndex: 0,
    immediateDecoder: ImmediateDecoder.new(),
  };

  results[ArgumentType.ONE_REGISTER_ONE_IMMEDIATE] = {
    type: ArgumentType.ONE_REGISTER_ONE_IMMEDIATE,
    noOfBytesToSkip: 1,
    registerIndex: 0,
    immediateDecoder: ImmediateDecoder.new(),
  };

  results[ArgumentType.ONE_REGISTER_TWO_IMMEDIATES] = {
    type: ArgumentType.ONE_REGISTER_TWO_IMMEDIATES,
    noOfBytesToSkip: 1,
    registerIndex: 0,
    firstImmediateDecoder: ImmediateDecoder.new(),
    secondImmediateDecoder: ImmediateDecoder.new(),
  };

  results[ArgumentType.ONE_OFFSET] = {
    type: ArgumentType.ONE_OFFSET,
    noOfBytesToSkip: 1,
    nextPc: 0,
  };

  results[ArgumentType.TWO_IMMEDIATES] = {
    type: ArgumentType.TWO_IMMEDIATES,
    noOfBytesToSkip: 1,
    firstImmediateDecoder: ImmediateDecoder.new(),
    secondImmediateDecoder: ImmediateDecoder.new(),
  };

  results[ArgumentType.TWO_REGISTERS_TWO_IMMEDIATES] = {
    type: ArgumentType.TWO_REGISTERS_TWO_IMMEDIATES,
    noOfBytesToSkip: 1,
    firstImmediateDecoder: ImmediateDecoder.new(),
    secondImmediateDecoder: ImmediateDecoder.new(),
    firstRegisterIndex: 0,
    secondRegisterIndex: 0,
  };

  results[ArgumentType.ONE_REGISTER_ONE_EXTENDED_WIDTH_IMMEDIATE] = {
    type: ArgumentType.ONE_REGISTER_ONE_EXTENDED_WIDTH_IMMEDIATE,
    noOfBytesToSkip: 9,
    registerIndex: 0,
    immediateDecoder: ExtendedWitdthImmediateDecoder.new(),
  };

  return results;
};
