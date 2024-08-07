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
import { Status } from "./status";

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
  private oneImmDispatcher: OneImmDispatcher;
  private status = Status.OK;

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
    this.oneRegisterOneImmediateOneOffsetDispatcher = new OneRegisterOneImmediateOneOffsetDispatcher(branchOps);
    this.twoRegsOneOffsetDispatcher = new TwoRegsOneOffsetDispatcher(branchOps);
    this.oneOffsetDispatcher = new OneOffsetDispatcher(branchOps);
    this.oneRegisterOneImmediateDispatcher = new OneRegisterOneImmediateDispatcher(loadOps, storeOps, dynamicJumpOps);
    this.twoImmsDispatcher = new TwoImmsDispatcher(storeOps);
    this.oneRegTwoImmsDispatcher = new OneRegTwoImmsDispatcher(storeOps);
    this.noArgsDispatcher = new NoArgsDispatcher(noArgsOps);
    this.twoRegsTwoImmsDispatcher = new TwoRegsTwoImmsDispatcher(loadOps, dynamicJumpOps);
    this.oneImmDispatcher = new OneImmDispatcher(hostCallOps);
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
     * Reference: https://graypaper.fluffylabs.dev/#WyI0ODY2YjU5YmMwZjYyMTU4ZGEwM2E2YmVhMTMyODRhMTM4ZjJlZWU1IiwiMjIiLCJBY2tub3dsZWRnZW1lbnRzIixudWxsLFsiPGRpdiBjbGFzcz1cInQgbTAgeDEwIGgyIHkxMWQwIGZmNyBmczAgZmMwIHNjMCBsczAgd3MwXCI+PHNwYW4gY2xhc3M9XCJmZjFcIj48c3BhbiBjbGFzcz1cImZmN1wiPk5vdGU8c3BhbiBjbGFzcz1cIl8gXzEyXCI+IDwvc3Bhbj50aGF0PHNwYW4gY2xhc3M9XCJfIF8xMlwiPiA8L3NwYW4+aW48c3BhbiBjbGFzcz1cIl9cIj4gPC9zcGFuPnRoZTxzcGFuIGNsYXNzPVwiXyBfMTJcIj4gPC9zcGFuPmNhc2U8c3BhbiBjbGFzcz1cIl8gXzEyXCI+IDwvc3Bhbj50aGF0PHNwYW4gY2xhc3M9XCJfXCI+IDwvc3Bhbj50aGU8c3BhbiBjbGFzcz1cIl8gXzEyXCI+IDwvc3Bhbj5vcGNvPHNwYW4gY2xhc3M9XCJfIF83XCI+PC9zcGFuPmRlPHNwYW4gY2xhc3M9XCJfXCI+IDwvc3Bhbj5pczxzcGFuIGNsYXNzPVwiXyBfMTJcIj4gPC9zcGFuPm5vdDxzcGFuIGNsYXNzPVwiXyBfMTJcIj4gPC9zcGFuPmRl7pm9bmVkPHNwYW4gY2xhc3M9XCJfIF8xMlwiPiA8L3NwYW4+aW48c3BhbiBjbGFzcz1cIl9cIj4gPC9zcGFuPnRoZTxzcGFuIGNsYXNzPVwiXyBfMTJcIj4gPC9zcGFuPmZvbGxvPHNwYW4gY2xhc3M9XCJfIF8wXCI+PC9zcGFuPndpbmc8c3BhbiBjbGFzcz1cIl8gXzEyXCI+IDwvc3Bhbj50YWJsZXM8c3BhbiBjbGFzcz1cIl8gXzEyXCI+IDwvc3Bhbj50aGVuPHNwYW4gY2xhc3M9XCJfXCI+IDwvc3Bhbj50aGU8c3BhbiBjbGFzcz1cIl8gXzEyXCI+IDwvc3Bhbj5pbnN0cnVjdGlvbjwvc3Bhbj48L3NwYW4+PC9kaXY+IiwiPGRpdiBjbGFzcz1cInQgbTAgeDEwIGhiIHkxMWQxIGZmNyBmczAgZmMwIHNjMCBsczAgd3MwXCI+aXM8c3BhbiBjbGFzcz1cIl8gXzlcIj4gPC9zcGFuPmNvbnNpZGVyZWQ8c3BhbiBjbGFzcz1cIl8gXzlcIj4gPC9zcGFuPmluPHNwYW4gY2xhc3M9XCJfIF81XCI+PC9zcGFuPnY8c3BhbiBjbGFzcz1cIl8gXzBcIj48L3NwYW4+YWxpZCw8c3BhbiBjbGFzcz1cIl8gXzlcIj4gPC9zcGFuPmFuZDxzcGFuIGNsYXNzPVwiXyBfNFwiPiA8L3NwYW4+aXQ8c3BhbiBjbGFzcz1cIl8gXzlcIj4gPC9zcGFuPnJlc3VsdHM8c3BhbiBjbGFzcz1cIl8gXzlcIj4gPC9zcGFuPmluPHNwYW4gY2xhc3M9XCJfIF85XCI+IDwvc3Bhbj5hPHNwYW4gY2xhc3M9XCJfIF85XCI+IDwvc3Bhbj5wYW5pYzs8c3BhbiBjbGFzcz1cIl8gXzRcIj4gPC9zcGFuPjxzcGFuIGNsYXNzPVwiZmYxMFwiPs61PHNwYW4gY2xhc3M9XCJfIF82XCI+IDwvc3Bhbj48c3BhbiBjbGFzcz1cImZmMTRcIj49PHNwYW4gY2xhc3M9XCJfIF82XCI+IDwvc3Bhbj48c3BhbiBjbGFzcz1cImZmMTZcIj7imIc8L3NwYW4+PC9zcGFuPjwvc3Bhbj48L2Rpdj4iXV0=
     */
    const currentInstruction = this.code[this.pc] ?? Instruction.TRAP;
    this.gas -= instructionGasMap[currentInstruction];

    if (this.gas < 0) {
      this.status = Status.OUT_OF_GAS;
      return this.status;
    }

    const args = this.argsDecoder.getArgs(this.pc);
    this.instructionResult.pcOffset = args.noOfBytesToSkip;
    switch (args.type) {
      case ArgumentType.NO_ARGUMENTS:
        this.noArgsDispatcher.dispatch(currentInstruction);
        break;
      case ArgumentType.ONE_IMMEDIATE:
        this.oneImmDispatcher.dispatch(currentInstruction, args);
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

    this.pc += this.instructionResult.pcOffset;
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
