import { ArgsDecoder } from "./args-decoder/args-decoder";
import { ArgumentType } from "./args-decoder/argument-type";
import { assemblify } from "./assemblify";
import { BasicBlocks } from "./basic-blocks";
import { Instruction } from "./instruction";
import { instructionGasMap } from "./instruction-gas-map";
import { InstructionResult } from "./instruction-result";
import { Memory } from "./memory";
import {
  BitOps,
  BooleanOps,
  BranchOps,
  DynamicJumpOps,
  HostCallOps,
  LoadOps,
  MathOps,
  MoveOps,
  NoArgsOps,
  ShiftOps,
  StoreOps,
} from "./ops";
import {
  NoArgsDispatcher,
  OneImmDispatcher,
  OneOffsetDispatcher,
  OneRegOneImmDispatcher,
  OneRegOneImmOneOffsetDispatcher,
  OneRegTwoImmsDispatcher,
  ThreeRegsDispatcher,
  TwoImmsDispatcher,
  TwoRegsDispatcher,
  TwoRegsOneImmDispatcher,
  TwoRegsOneOffsetDispatcher,
  TwoRegsTwoImmsDispatcher,
} from "./ops-dispatchers";
import type { Mask } from "./program-decoder/mask";
import { ProgramDecoder } from "./program-decoder/program-decoder";
import { NO_OF_REGISTERS, Registers } from "./registers";
import { Result } from "./result";
import { Status } from "./status";

type InitialState = {
  regs?: RegistersArray;
  pc?: number;
  gas?: number;
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
  private oneRegOneImmOneOffsetDispatcher: OneRegOneImmOneOffsetDispatcher;
  private twoRegsOneOffsetDispatcher: TwoRegsOneOffsetDispatcher;
  private oneOffsetDispatcher: OneOffsetDispatcher;
  private oneRegOneImmDispatcher: OneRegOneImmDispatcher;
  private instructionResult = new InstructionResult();
  private memory: Memory;
  private twoImmsDispatcher: TwoImmsDispatcher;
  private oneRegTwoImmsDispatcher: OneRegTwoImmsDispatcher;
  private noArgsDispatcher: NoArgsDispatcher;
  private twoRegsTwoImmsDispatcher: TwoRegsTwoImmsDispatcher;
  private oneImmDispatcher: OneImmDispatcher;
  private status = Status.OK;

  constructor(rawProgram: Uint8Array, initialState: InitialState = {}) {
    const programDecoder = new ProgramDecoder(rawProgram);
    this.code = programDecoder.getCode();
    this.mask = programDecoder.getMask();
    const jumpTable = programDecoder.getJumpTable();
    this.registers = new Registers();
    this.memory = new Memory();
    this.pc = initialState.pc ?? 0;

    for (let i = 0; i < NO_OF_REGISTERS; i++) {
      this.registers.asUnsigned[i] = initialState.regs?.[i] ?? 0;
    }
    this.gas = initialState.gas ?? 0;

    this.argsDecoder = new ArgsDecoder(this.code, this.mask);
    const basicBlocks = new BasicBlocks(this.code, this.mask);

    const mathOps = new MathOps(this.registers);
    const shiftOps = new ShiftOps(this.registers);
    const bitOps = new BitOps(this.registers);
    const booleanOps = new BooleanOps(this.registers);
    const moveOps = new MoveOps(this.registers);
    const branchOps = new BranchOps(this.registers, this.instructionResult, basicBlocks);
    const loadOps = new LoadOps(this.registers, this.memory, this.instructionResult);
    const storeOps = new StoreOps(this.registers, this.memory, this.instructionResult);
    const noArgsOps = new NoArgsOps(this.instructionResult);
    const dynamicJumpOps = new DynamicJumpOps(this.registers, jumpTable, this.instructionResult, basicBlocks);
    const hostCallOps = new HostCallOps(this.instructionResult);

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
    this.oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);
    this.twoRegsOneOffsetDispatcher = new TwoRegsOneOffsetDispatcher(branchOps);
    this.oneOffsetDispatcher = new OneOffsetDispatcher(branchOps);
    this.oneRegOneImmDispatcher = new OneRegOneImmDispatcher(loadOps, storeOps, dynamicJumpOps);
    this.twoImmsDispatcher = new TwoImmsDispatcher(storeOps);
    this.oneRegTwoImmsDispatcher = new OneRegTwoImmsDispatcher(storeOps);
    this.noArgsDispatcher = new NoArgsDispatcher(noArgsOps);
    this.twoRegsTwoImmsDispatcher = new TwoRegsTwoImmsDispatcher(loadOps, dynamicJumpOps);
    this.oneImmDispatcher = new OneImmDispatcher(hostCallOps);
  }

  setMemory(readOnlyData: Uint8Array, initialHeap: Uint8Array, stackSize: number, noOfHeapPages: number) {
    this.memory.setupMemory(readOnlyData, initialHeap, stackSize, noOfHeapPages);
  }

  setRegisters() {}

  printProgram() {
    const p = assemblify(this.code, this.mask);
    console.table(p);
  }

  runProgram() {
    while (this.nextStep() === Status.OK) {}
  }

  nextStep() {
    /**
     * We have two options to handle an invalid instruction:
     * - change status to panic and quit program immediately,
     * - treat the invalid instruction as a regular trap.
     * The difference is that in the second case we don't need any additional condition and gas will be subtracted automagically so this option is implemented
     * Reference: https://graypaper.fluffylabs.dev/#WyI0ODY2YjU5YmMwIiwiMjIiLCJBY2tub3dsZWRnZW1lbnRzIixudWxsLFsiPGRpdiBjbGFzcz1cInQgbTAgeDEwIGgyIHkxMWQwIGZmNyBmczAgZmMwIHNjMCBsczAgd3MwXCI+IiwiPGRpdiBjbGFzcz1cInQgbTAgeDEwIGhiIHkxMWQxIGZmNyBmczAgZmMwIHNjMCBsczAgd3MwXCI+Il1d
     */
    const currentInstruction = this.code[this.pc] ?? Instruction.TRAP;
    this.gas -= instructionGasMap[currentInstruction];

    if (this.gas < 0) {
      this.status = Status.OUT_OF_GAS;
      return this.status;
    }

    const args = this.argsDecoder.getArgs(this.pc);
    this.instructionResult.nextPc = this.pc + args.noOfBytesToSkip;
    switch (args.type) {
      case ArgumentType.NO_ARGUMENTS:
        this.noArgsDispatcher.dispatch(currentInstruction);
        break;
      case ArgumentType.ONE_IMMEDIATE:
        this.oneImmDispatcher.dispatch(currentInstruction, args);
        break;
      case ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET:
        this.oneRegOneImmOneOffsetDispatcher.dispatch(currentInstruction, args);
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
        this.oneRegOneImmDispatcher.dispatch(currentInstruction, args);
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

      switch (this.instructionResult.status) {
        case Result.FAULT:
          this.status = Status.PANIC;
          break;
        case Result.HALT:
          this.status = Status.HALT;
          break;
        case Result.PANIC:
          this.status = Status.PANIC;
          break;
      }
      return this.status;
    }

    this.pc = this.instructionResult.nextPc;
    return this.status;
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
    return this.status;
  }

  getMemoryPage(pageNumber: number): Uint8Array | null {
    return this.memory.getPageDump(pageNumber);
  }
}
