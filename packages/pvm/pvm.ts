import { ArgsDecoder } from "./args-decoder/args-decoder";
import { ArgumentType } from "./args-decoder/argument-type";
import { assemblify } from "./assemblify";
import { Instruction } from "./instruction";
import { instructionGasMap } from "./instruction-gas-map";
import { InstructionResult } from "./instruction-result";
import { Memory } from "./memory";
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
import { TwoImmsDispatcher } from "./ops-dispatchers/two-imms-dispatcher";
import { StoreOps } from "./ops/store-ops";
import { PageMap } from "./page-map";
import type { Mask } from "./program-decoder/mask";
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
  contents: Uint8Array;
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
  private registers: Registers;
  private code: Uint8Array;
  private mask: Mask;
  private pc: number;
  private gas: number;
  private status: "trap" | "halt" = "trap";
  private argsDecoder: ArgsDecoder;
  private threeRegsDispatcher: ThreeRegsDispatcher;
  private twoRegsOneImmDispatcher: TwoRegsOneImmDispatcher;
  private twoRegsDispatcher: TwoRegsDispatcher;
  private oneRegisterOneImmediateOneOffsetDispatcher: OneRegisterOneImmediateOneOffsetDispatcher;
  private twoRegsOneOffsetDispatcher: TwoRegsOneOffsetDispatcher;
  private oneOffsetDispatcher: OneOffsetDispatcher;
  private oneRegisterOneImmediateDispatcher: OneRegisterOneImmediateDispatcher;
  private instructionResult = new InstructionResult();
  private memory: Memory;
  private twoImmsDispatcher: TwoImmsDispatcher;

  constructor(rawProgram: Uint8Array, initialState: InitialState = {}) {
    const programDecoder = new ProgramDecoder(rawProgram);
    this.code = programDecoder.getCode();
    this.mask = programDecoder.getMask();
    this.registers = new Registers();
    const pageMap = new PageMap(initialState.pageMap ?? []);
    this.memory = new Memory(pageMap, initialState.memory ?? []);
    this.pc = initialState.pc ?? 0;

    for (let i = 0; i < NO_OF_REGISTERS; i++) {
      this.registers.asUnsigned[i] = initialState.regs?.[i] ?? 0;
    }
    this.gas = initialState.gas ?? 0;

    this.argsDecoder = new ArgsDecoder(this.code, this.mask);

    const mathOps = new MathOps(this.registers);
    const shiftOps = new ShiftOps(this.registers);
    const bitOps = new BitOps(this.registers);
    const booleanOps = new BooleanOps(this.registers);
    const moveOps = new MoveOps(this.registers);
    const branchOps = new BranchOps(this.registers, this.instructionResult);
    const loadOps = new LoadOps(this.registers, this.memory);
    const storeOps = new StoreOps(this.registers, this.memory);

    this.threeRegsDispatcher = new ThreeRegsDispatcher(mathOps, shiftOps, bitOps, booleanOps, moveOps);
    this.twoRegsOneImmDispatcher = new TwoRegsOneImmDispatcher(mathOps, shiftOps, bitOps, booleanOps, moveOps);
    this.twoRegsDispatcher = new TwoRegsDispatcher(moveOps);
    this.oneRegisterOneImmediateOneOffsetDispatcher = new OneRegisterOneImmediateOneOffsetDispatcher(branchOps);
    this.twoRegsOneOffsetDispatcher = new TwoRegsOneOffsetDispatcher(branchOps);
    this.oneOffsetDispatcher = new OneOffsetDispatcher(branchOps);
    this.oneRegisterOneImmediateDispatcher = new OneRegisterOneImmediateDispatcher(loadOps, storeOps);
    this.twoImmsDispatcher = new TwoImmsDispatcher(storeOps);
  }

  printProgram() {
    const p = assemblify(this.code, this.mask);
    console.table(p);
  }

  runProgram() {
    while (this.pc < this.code.length) {
      const currentInstruction = this.code[this.pc];
      this.gas -= instructionGasMap[currentInstruction];

      if (this.gas < 0) {
        break;
      }

      const args = this.argsDecoder.getArgs(this.pc);
      this.instructionResult.pcOffset = args.noOfInstructionsToSkip;
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
        case ArgumentType.TWO_IMMEDIATES:
          this.twoImmsDispatcher.dispatch(currentInstruction, args);
          break;
      }
      this.pc += this.instructionResult.pcOffset;
    }

    // Gray Paper defines that the code is infinitely extended with `0` opcodes (`TRAP`).
    // Hence the final instruction will always be `TRAP` and we subtract the gas accordingly at the very end.
    this.gas -= instructionGasMap[Instruction.TRAP];

    if (this.gas < 0) {
      // TODO [MaSi]: to handle
    }
  }

  getState() {
    const regs = Array<number>(NO_OF_REGISTERS);

    for (let i = 0; i < NO_OF_REGISTERS; i++) {
      regs[i] = Number(this.registers.asUnsigned[i]);
    }

    return {
      pc: this.pc,
      regs,
      gas: this.gas,
      memory: this.memory.getMemoryDump(),
      status: this.status,
    };
  }
}
