import { ArgsDecoder } from "./args-decoder/args-decoder";
import { ArgumentType } from "./args-decoder/argument-type";
import { assemblify } from "./assemblify";
import { Instruction } from "./instruction";
import { instructionGasMap } from "./instruction-gas-map";
import { InstructionResult } from "./instruction-result";
import { Memory } from "./memory";
import {
  BitOps,
  BooleanOps,
  BranchOps,
  DynamicJumpOps,
  LoadOps,
  MathOps,
  MoveOps,
  NoArgsOps,
  ShiftOps,
  StoreOps,
} from "./ops";
import {
  NoArgsDispatcher,
  OneOffsetDispatcher,
  OneRegTwoImmsDispatcher,
  OneRegisterOneImmediateDispatcher,
  OneRegisterOneImmediateOneOffsetDispatcher,
  ThreeRegsDispatcher,
  TwoImmsDispatcher,
  TwoRegsDispatcher,
  TwoRegsOneImmDispatcher,
  TwoRegsOneOffsetDispatcher,
  TwoRegsTwoImmsDispatcher,
} from "./ops-dispatchers";
import { PageMap } from "./page-map";
import type { Mask } from "./program-decoder/mask";
import { ProgramDecoder } from "./program-decoder/program-decoder";
import { NO_OF_REGISTERS, Registers } from "./registers";
import { Result } from "./result";

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
  private oneRegTwoImmsDispatcher: OneRegTwoImmsDispatcher;
  private noArgsDispatcher: NoArgsDispatcher;
  private twoRegsTwoImmsDispatcher: TwoRegsTwoImmsDispatcher;

  constructor(rawProgram: Uint8Array, initialState: InitialState = {}) {
    const programDecoder = new ProgramDecoder(rawProgram);
    this.code = programDecoder.getCode();
    this.mask = programDecoder.getMask();
    const jumpTable = programDecoder.getJumpTable();
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
    const loadOps = new LoadOps(this.registers, this.memory, this.instructionResult);
    const storeOps = new StoreOps(this.registers, this.memory, this.instructionResult);
    const noArgsOps = new NoArgsOps(this.instructionResult);
    const dynamicJumpOps = new DynamicJumpOps(this.registers, jumpTable, this.instructionResult, this.mask);

    this.threeRegsDispatcher = new ThreeRegsDispatcher(mathOps, shiftOps, bitOps, booleanOps, moveOps);
    this.twoRegsOneImmDispatcher = new TwoRegsOneImmDispatcher(
      mathOps,
      shiftOps,
      bitOps,
      booleanOps,
      moveOps,
      storeOps,
      loadOps,
    );
    this.twoRegsDispatcher = new TwoRegsDispatcher(moveOps);
    this.oneRegisterOneImmediateOneOffsetDispatcher = new OneRegisterOneImmediateOneOffsetDispatcher(branchOps);
    this.twoRegsOneOffsetDispatcher = new TwoRegsOneOffsetDispatcher(branchOps);
    this.oneOffsetDispatcher = new OneOffsetDispatcher(branchOps);
    this.oneRegisterOneImmediateDispatcher = new OneRegisterOneImmediateDispatcher(loadOps, storeOps, dynamicJumpOps);
    this.twoImmsDispatcher = new TwoImmsDispatcher(storeOps);
    this.oneRegTwoImmsDispatcher = new OneRegTwoImmsDispatcher(storeOps);
    this.noArgsDispatcher = new NoArgsDispatcher(noArgsOps);
    this.twoRegsTwoImmsDispatcher = new TwoRegsTwoImmsDispatcher(loadOps, dynamicJumpOps);
  }

  printProgram() {
    const p = assemblify(this.code, this.mask);
    console.table(p);
  }

  runProgram() {
    while (this.nextStep()) {}
  }

  nextStep() {
    const currentInstruction = this.code[this.pc] ?? Instruction.TRAP;
    this.gas -= instructionGasMap[currentInstruction];

    if (this.gas < 0) {
      // TODO [MaSi]: to handle
      return false;
    }

    const args = this.argsDecoder.getArgs(this.pc);
    this.instructionResult.pcOffset = args.noOfInstructionsToSkip;
    switch (args.type) {
      case ArgumentType.NO_ARGUMENTS:
        this.noArgsDispatcher.dispatch(currentInstruction);
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
      case ArgumentType.ONE_REGISTER_TWO_IMMEDIATES:
        this.oneRegTwoImmsDispatcher.dispatch(currentInstruction, args);
        break;
      case ArgumentType.TWO_REGISTERS_TWO_IMMEDIATES:
        this.twoRegsTwoImmsDispatcher.dispatch(currentInstruction, args);
        break;
    }

    if (this.instructionResult.status !== null) {
      // All abnormal terminations should be interpreted as TRAP and we should subtract the gas. In case of FAULT we have to do it manually at the very end.
      if (this.instructionResult.status === Result.FAULT) {
        this.gas -= instructionGasMap[Instruction.TRAP];
      }
      return false;
    }

    this.pc += this.instructionResult.pcOffset;
    return true;
  }

  getRegisters() {
    return this.registers.asUnsigned;
  }

  getMemory() {
    return this.memory.getMemoryDump();
  }

  getPC() {
    return this.pc;
  }

  getGas() {
    return this.gas;
  }

  getStatus() {
    if (this.instructionResult.status === null) {
      return null;
    }

    if (this.instructionResult.status === Result.FAULT || this.instructionResult.status === Result.PANIC) {
      return "trap";
    }

    return "halt";
  }
  getMemoryPage(): Uint8Array | null {}
}
