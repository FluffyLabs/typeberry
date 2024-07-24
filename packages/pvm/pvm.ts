import { ArgsDecoder } from "./args-decoder/args-decoder";
import { ArgumentType } from "./args-decoder/argument-type";
import { assemblify } from "./assemblify";
import { Context } from "./context";
import { Instruction } from "./instruction";
import { instructionGasMap } from "./instruction-gas-map";
import { BitOps, BooleanOps, BranchOps, LoadOps, MathOps, MoveOps, ShiftOps } from "./ops";
import {
  OneOffsetDispatcher,
  OneRegisterOneImmediateDispatcher,
  OneRegisterOneImmediateOneOffsetDispatcher,
  ThreeRegsDispatcher,
  TwoRegsDispatcher,
  TwoRegsOneImmDispatcher,
  TwoRegsOneOffsetDispatcher,
} from "./ops-dispatchers";
import { ProgramDecoder } from "./program-decoder/program-decoder";
import { NO_OF_REGISTERS, Registers } from "./registers";

type InitialState = {
  regs?: RegistersArray;
  pc?: number;
  pageMap?: PageMapItem[];
  memory?: MemoryChunkItem[];
  gas?: number;
};

type MemoryChunkItem = {
  address: number;
  contents: number[];
};

type PageMapItem = {
  address: number;
  length: number;
  "is-writable": boolean;
};

type GrowToSize<T, N extends number, A extends T[]> = A["length"] extends N ? A : GrowToSize<T, N, [...A, T]>;

type FixedArray<T, N extends number> = GrowToSize<T, N, []>;

export type RegistersArray = FixedArray<number, 13>;

export class Pvm {
  private context: Context;
  private gas: number;
  private pageMap: PageMapItem[];
  private memory: MemoryChunkItem[];
  private status: "trap" | "halt" = "trap";
  private argsDecoder: ArgsDecoder;
  private threeRegsDispatcher: ThreeRegsDispatcher;
  private twoRegsOneImmDispatcher: TwoRegsOneImmDispatcher;
  private twoRegsDispatcher: TwoRegsDispatcher;
  private oneRegisterOneImmediateOneOffsetDispatcher: OneRegisterOneImmediateOneOffsetDispatcher;
  private twoRegsOneOffsetDispatcher: TwoRegsOneOffsetDispatcher;
  private oneOffsetDispatcher: OneOffsetDispatcher;
  private oneRegisterOneImmediateDispatcher: OneRegisterOneImmediateDispatcher;

  constructor(rawProgram: Uint8Array, initialState: InitialState = {}) {
    const programDecoder = new ProgramDecoder(rawProgram);
    const code = programDecoder.getCode();
    const mask = programDecoder.getMask();
    const registers = new Registers();
    const pc = initialState.pc ?? 0;

    for (let i = 0; i < NO_OF_REGISTERS; i++) {
      registers.asUnsigned[i] = initialState.regs?.[i] ?? 0;
    }
    this.gas = initialState.gas ?? 0;
    this.pageMap = initialState.pageMap ?? [];
    this.memory = initialState.memory ?? [];

    this.context = new Context(code, mask, registers, pc);

    this.argsDecoder = new ArgsDecoder(this.context);

    const mathOps = new MathOps(this.context);
    const shiftOps = new ShiftOps(this.context);
    const bitOps = new BitOps(this.context);
    const booleanOps = new BooleanOps(this.context);
    const moveOps = new MoveOps(this.context);
    const branchOps = new BranchOps(this.context);
    const loadOps = new LoadOps(this.context);

    this.threeRegsDispatcher = new ThreeRegsDispatcher(mathOps, shiftOps, bitOps, booleanOps, moveOps);
    this.twoRegsOneImmDispatcher = new TwoRegsOneImmDispatcher(mathOps, shiftOps, bitOps, booleanOps, moveOps);
    this.twoRegsDispatcher = new TwoRegsDispatcher(moveOps);
    this.oneRegisterOneImmediateOneOffsetDispatcher = new OneRegisterOneImmediateOneOffsetDispatcher(branchOps);
    this.twoRegsOneOffsetDispatcher = new TwoRegsOneOffsetDispatcher(branchOps);
    this.oneOffsetDispatcher = new OneOffsetDispatcher(branchOps);
    this.oneRegisterOneImmediateDispatcher = new OneRegisterOneImmediateDispatcher(loadOps);
  }

  printProgram() {
    const p = assemblify(this.context.code, this.context.mask);
    console.table(p);
  }

  runProgram() {
    while (this.context.pc < this.context.code.length) {
      const currentInstruction = this.context.code[this.context.pc];
      this.gas -= instructionGasMap[currentInstruction];

      if (this.gas < 0) {
        break;
      }

      const args = this.argsDecoder.getArgs(this.context.pc);
      this.context.nextPc = this.context.pc + args.noOfInstructionsToSkip;

      switch (args.type) {
        case ArgumentType.NO_ARGUMENTS:
          if (currentInstruction === Instruction.TRAP) {
            this.status = "trap";
            return;
          }
          break;
        case ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET:
          this.oneRegisterOneImmediateOneOffsetDispatcher.dispatch(currentInstruction, args);
          break;
        case ArgumentType.TWO_REGISTERS:
          this.twoRegsDispatcher.dispatch(currentInstruction, args);
          break;
        case ArgumentType.THREE_REGISTERS:
          this.threeRegsDispatcher.dispatch(currentInstruction, args);
          break;
        case ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE:
          this.twoRegsOneImmDispatcher.dispatch(currentInstruction, args);
          break;
        case ArgumentType.TWO_REGISTERS_ONE_OFFSET:
          this.twoRegsOneOffsetDispatcher.dispatch(currentInstruction, args);
          break;
        case ArgumentType.ONE_OFFSET:
          this.oneOffsetDispatcher.dispatch(currentInstruction, args);
          break;
        case ArgumentType.ONE_REGISTER_ONE_IMMEDIATE:
          this.oneRegisterOneImmediateDispatcher.dispatch(currentInstruction, args);
          break;
      }
      this.context.pc = this.context.nextPc;
    }

    this.gas -= instructionGasMap[Instruction.TRAP];

    if (this.gas < 0) {
      // TODO [MaSi]: to handle
    }
  }

  getState() {
    const regs = Array<number>(NO_OF_REGISTERS);

    for (let i = 0; i < NO_OF_REGISTERS; i++) {
      regs[i] = Number(this.context.regs.asUnsigned[i]);
    }

    return {
      pc: this.context.pc,
      regs,
      gas: this.gas,
      pageMap: this.pageMap,
      memory: this.memory,
      status: this.status,
    };
  }
}
