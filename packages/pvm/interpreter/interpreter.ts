import {U32} from "@typeberry/numbers";
import { ArgsDecoder } from "./args-decoder/args-decoder";
import { createResults } from "./args-decoder/args-decoding-results";
import { ArgumentType } from "./args-decoder/argument-type";
import { instructionArgumentTypeMap } from "./args-decoder/instruction-argument-type-map";
import { assemblify } from "./assemblify";
import { BasicBlocks } from "./basic-blocks";
import { Instruction } from "./instruction";
import { instructionGasMap } from "./instruction-gas-map";
import { InstructionResult } from "./instruction-result";
import { Memory } from "./memory";
import { createPageNumber } from "./memory/pages/page-utils";
import {
  BitOps,
  BooleanOps,
  BranchOps,
  DynamicJumpOps,
  HostCallOps,
  LoadOps,
  MathOps,
  MemoryOps,
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
import { JumpTable } from "./program-decoder/jump-table";
import { Mask } from "./program-decoder/mask";
import { ProgramDecoder } from "./program-decoder/program-decoder";
import { Registers } from "./registers";
import { Result } from "./result";
import { Status } from "./status";
import {Gas, GasCounter, gasCounter} from "./gas";

export class Interpreter {
  private registers = new Registers();
  private code = new Uint8Array();
  private mask = Mask.empty();
  private pc = 0;
  private gas = gasCounter(0 as Gas);
  private argsDecoder: ArgsDecoder;
  private threeRegsDispatcher: ThreeRegsDispatcher;
  private twoRegsOneImmDispatcher: TwoRegsOneImmDispatcher;
  private twoRegsDispatcher: TwoRegsDispatcher;
  private oneRegOneImmOneOffsetDispatcher: OneRegOneImmOneOffsetDispatcher;
  private twoRegsOneOffsetDispatcher: TwoRegsOneOffsetDispatcher;
  private oneOffsetDispatcher: OneOffsetDispatcher;
  private oneRegOneImmDispatcher: OneRegOneImmDispatcher;
  private instructionResult = new InstructionResult();
  private memory = new Memory();
  private twoImmsDispatcher: TwoImmsDispatcher;
  private oneRegTwoImmsDispatcher: OneRegTwoImmsDispatcher;
  private noArgsDispatcher: NoArgsDispatcher;
  private twoRegsTwoImmsDispatcher: TwoRegsTwoImmsDispatcher;
  private oneImmDispatcher: OneImmDispatcher;
  private status = Status.OK;
  private argsDecodingResults = createResults();
  private basicBlocks: BasicBlocks;
  private jumpTable = JumpTable.empty();

  constructor() {
    this.argsDecoder = new ArgsDecoder();
    this.basicBlocks = new BasicBlocks();
    const mathOps = new MathOps(this.registers);
    const shiftOps = new ShiftOps(this.registers);
    const bitOps = new BitOps(this.registers);
    const booleanOps = new BooleanOps(this.registers);
    const moveOps = new MoveOps(this.registers);
    const branchOps = new BranchOps(this.registers, this.instructionResult, this.basicBlocks);
    const loadOps = new LoadOps(this.registers, this.memory, this.instructionResult);
    const storeOps = new StoreOps(this.registers, this.memory, this.instructionResult);
    const noArgsOps = new NoArgsOps(this.instructionResult);
    const dynamicJumpOps = new DynamicJumpOps(this.registers, this.jumpTable, this.instructionResult, this.basicBlocks);
    const hostCallOps = new HostCallOps(this.instructionResult);
    const memoryOps = new MemoryOps(this.registers, this.memory);

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
    this.twoRegsDispatcher = new TwoRegsDispatcher(moveOps, memoryOps);
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

  reset(rawProgram: Uint8Array, pc: number, gas: Gas, maybeRegisters?: Registers, maybeMemory?: Memory) {
    const programDecoder = new ProgramDecoder(rawProgram);
    this.code = programDecoder.getCode();
    this.mask = programDecoder.getMask();
    this.jumpTable = programDecoder.getJumpTable();

    this.pc = pc;
    this.gas = gasCounter(gas);
    this.argsDecoder.reset(this.code, this.mask);
    this.basicBlocks.reset(this.code, this.mask);
    this.instructionResult.reset();

    if (maybeRegisters) {
      this.registers.copyFrom(maybeRegisters);
    } else {
      this.registers.reset();
    }

    if (maybeMemory) {
      this.memory.copyFrom(maybeMemory);
    } else {
      this.memory.reset();
    }
  }

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

    const underflow = this.gas.sub(instructionGasMap[currentInstruction]);

    if (underflow) {
      this.status = Status.OOG;
      return this.status;
    }
    const argsType = instructionArgumentTypeMap[currentInstruction];
    const argsResult = this.argsDecodingResults[argsType];
    this.argsDecoder.fillArgs(this.pc, argsResult);
    this.instructionResult.nextPc = this.pc + argsResult.noOfBytesToSkip;

    switch (argsResult.type) {
      case ArgumentType.NO_ARGUMENTS:
        this.noArgsDispatcher.dispatch(currentInstruction);
        break;
      case ArgumentType.ONE_IMMEDIATE:
        this.oneImmDispatcher.dispatch(currentInstruction, argsResult);
        break;
      case ArgumentType.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET:
        this.oneRegOneImmOneOffsetDispatcher.dispatch(currentInstruction, argsResult);
        break;
      case ArgumentType.TWO_REGISTERS:
        this.twoRegsDispatcher.dispatch(currentInstruction, argsResult);
        break;
      case ArgumentType.THREE_REGISTERS:
        this.threeRegsDispatcher.dispatch(currentInstruction, argsResult);
        break;
      case ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE:
        this.twoRegsOneImmDispatcher.dispatch(currentInstruction, argsResult);
        break;
      case ArgumentType.TWO_REGISTERS_ONE_OFFSET:
        this.twoRegsOneOffsetDispatcher.dispatch(currentInstruction, argsResult);
        break;
      case ArgumentType.ONE_OFFSET:
        this.oneOffsetDispatcher.dispatch(currentInstruction, argsResult);
        break;
      case ArgumentType.ONE_REGISTER_ONE_IMMEDIATE:
        this.oneRegOneImmDispatcher.dispatch(currentInstruction, argsResult);
        break;
      case ArgumentType.TWO_IMMEDIATES:
        this.twoImmsDispatcher.dispatch(currentInstruction, argsResult);
        break;
      case ArgumentType.ONE_REGISTER_TWO_IMMEDIATES:
        this.oneRegTwoImmsDispatcher.dispatch(currentInstruction, argsResult);
        break;
      case ArgumentType.TWO_REGISTERS_TWO_IMMEDIATES:
        this.twoRegsTwoImmsDispatcher.dispatch(currentInstruction, argsResult);
        break;
    }

    if (this.instructionResult.status !== null) {
      // All abnormal terminations should be interpreted as TRAP and we should subtract the gas. In case of FAULT we have to do it manually at the very end.
      if (this.instructionResult.status === Result.FAULT) {
        // TODO [ToDr] underflow?
        this.gas.sub(instructionGasMap[Instruction.TRAP]);
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
        case Result.HOST:
          this.status = Status.HOST;
          break;
      }
      return this.status;
    }

    this.pc = this.instructionResult.nextPc;
    return this.status;
  }

  getRegisters() {
    return this.registers;
  }

  getPC() {
    return this.pc;
  }

  setNextPC(nextPc: number) {
    this.pc = nextPc;
  }

  getGas(): Gas {
    return this.gas.get();
  }

  getGasCounter(): GasCounter {
    return this.gas;
  }

  getStatus() {
    return this.status;
  }

  getExitParam(): U32 {
    return this.instructionResult.exitParam as U32;
  }

  getMemory() {
    return this.memory;
  }

  getMemoryPage(pageNumber: number): null | Uint8Array {
    return this.memory.getPageDump(createPageNumber(pageNumber));
  }
}
