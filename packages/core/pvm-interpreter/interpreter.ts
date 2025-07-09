import { type U32, tryAsU32 } from "@typeberry/numbers";
import { ArgsDecoder } from "./args-decoder/args-decoder.js";
import { createResults } from "./args-decoder/args-decoding-results.js";
import { ArgumentType } from "./args-decoder/argument-type.js";
import { instructionArgumentTypeMap } from "./args-decoder/instruction-argument-type-map.js";
import { assemblify } from "./assemblify.js";
import { BasicBlocks } from "./basic-blocks/index.js";
import { type Gas, type GasCounter, gasCounter, tryAsBigGas, tryAsGas } from "./gas.js";
import { instructionGasMap } from "./instruction-gas-map.js";
import { InstructionResult } from "./instruction-result.js";
import { Instruction } from "./instruction.js";
import { Memory } from "./memory/index.js";
import { PAGE_SIZE } from "./memory/memory-consts.js";
import { alignToPageSize } from "./memory/memory-utils.js";
import { tryAsPageNumber } from "./memory/pages/page-utils.js";
import {
  NoArgsDispatcher,
  OneImmDispatcher,
  OneOffsetDispatcher,
  OneRegOneExtImmDispatcher,
  OneRegOneImmDispatcher,
  OneRegOneImmOneOffsetDispatcher,
  OneRegTwoImmsDispatcher,
  ThreeRegsDispatcher,
  TwoImmsDispatcher,
  TwoRegsDispatcher,
  TwoRegsOneImmDispatcher,
  TwoRegsOneOffsetDispatcher,
  TwoRegsTwoImmsDispatcher,
} from "./ops-dispatchers/index.js";
import {
  BitOps,
  BitRotationOps,
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
} from "./ops/index.js";
import { JumpTable } from "./program-decoder/jump-table.js";
import { Mask } from "./program-decoder/mask.js";
import { ProgramDecoder } from "./program-decoder/program-decoder.js";
import { Registers } from "./registers.js";
import { Result } from "./result.js";
import { Status } from "./status.js";

export class Interpreter {
  private registers = new Registers();
  private code: Uint8Array = new Uint8Array();
  private mask = Mask.empty();
  private pc = 0;
  private gas = gasCounter(tryAsGas(0));
  private initialGas = gasCounter(tryAsGas(0));
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
  private oneRegOneExtImmDispatcher: OneRegOneExtImmDispatcher;
  private status = Status.OK;
  private argsDecodingResults = createResults();
  private basicBlocks: BasicBlocks;
  private jumpTable = JumpTable.empty();

  constructor(
    private useSbrkGas = false,
    private freeExecution = false,
  ) {
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
    const memoryOps = new MemoryOps(this.registers, this.memory, this.instructionResult);
    const bitRotationOps = new BitRotationOps(this.registers);

    this.threeRegsDispatcher = new ThreeRegsDispatcher(mathOps, shiftOps, bitOps, booleanOps, moveOps, bitRotationOps);
    this.twoRegsOneImmDispatcher = new TwoRegsOneImmDispatcher(
      mathOps,
      shiftOps,
      bitOps,
      booleanOps,
      moveOps,
      storeOps,
      loadOps,
      bitRotationOps,
    );
    this.twoRegsDispatcher = new TwoRegsDispatcher(moveOps, memoryOps, bitOps, bitRotationOps);
    this.oneRegOneImmOneOffsetDispatcher = new OneRegOneImmOneOffsetDispatcher(branchOps, loadOps);
    this.twoRegsOneOffsetDispatcher = new TwoRegsOneOffsetDispatcher(branchOps);
    this.oneOffsetDispatcher = new OneOffsetDispatcher(branchOps);
    this.oneRegOneImmDispatcher = new OneRegOneImmDispatcher(loadOps, storeOps, dynamicJumpOps);
    this.twoImmsDispatcher = new TwoImmsDispatcher(storeOps);
    this.oneRegTwoImmsDispatcher = new OneRegTwoImmsDispatcher(storeOps);
    this.noArgsDispatcher = new NoArgsDispatcher(noArgsOps);
    this.twoRegsTwoImmsDispatcher = new TwoRegsTwoImmsDispatcher(loadOps, dynamicJumpOps);
    this.oneImmDispatcher = new OneImmDispatcher(hostCallOps);
    this.oneRegOneExtImmDispatcher = new OneRegOneExtImmDispatcher(loadOps);
  }

  reset(rawProgram: Uint8Array, pc: number, gas: Gas, maybeRegisters?: Registers, maybeMemory?: Memory) {
    const programDecoder = new ProgramDecoder(rawProgram);
    this.code = programDecoder.getCode();
    this.mask = programDecoder.getMask();
    this.jumpTable.copyFrom(programDecoder.getJumpTable());

    this.pc = pc;
    this.gas = gasCounter(gas);
    this.initialGas = gasCounter(gas);
    this.status = Status.OK;
    this.argsDecoder.reset(this.code, this.mask);
    this.basicBlocks.reset(this.code, this.mask);
    this.instructionResult.reset();

    if (maybeRegisters !== undefined) {
      this.registers.copyFrom(maybeRegisters);
    } else {
      this.registers.reset();
    }

    if (maybeMemory !== undefined) {
      this.memory.copyFrom(maybeMemory);
    } else {
      this.memory.reset();
    }
  }

  printProgram() {
    const p = assemblify(this.code, this.mask);
    console.table(p);
    return p;
  }

  runProgram() {
    while (this.nextStep() === Status.OK) {}
  }

  nextStep() {
    // we are being resumed from a host call, assume all good.
    if (this.status === Status.HOST) {
      this.status = Status.OK;
      this.pc = this.instructionResult.nextPc;
      this.instructionResult.reset();
    }

    /**
     * We have two options to handle an invalid instruction:
     * - change status to panic and quit program immediately,
     * - treat the invalid instruction as a regular trap.
     * The difference is that in the second case we don't need any additional condition and gas will be subtracted automagically so this option is implemented
     * Reference: https://graypaper.fluffylabs.dev/#/579bd12/251100251200
     */
    const currentInstruction = this.code[this.pc] ?? Instruction.TRAP;
    const isValidInstruction = Instruction[currentInstruction] !== undefined;
    const gasCost = instructionGasMap[currentInstruction] ?? instructionGasMap[Instruction.TRAP];
    const underflow = this.freeExecution ? false : this.gas.sub(gasCost);
    if (underflow) {
      this.status = Status.OOG;
      return this.status;
    }
    const argsType = instructionArgumentTypeMap[currentInstruction] ?? ArgumentType.NO_ARGUMENTS;
    const argsResult = this.argsDecodingResults[argsType];
    this.argsDecoder.fillArgs(this.pc, argsResult);

    if (!isValidInstruction) {
      this.instructionResult.status = Result.PANIC;
    } else {
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
          if (this.useSbrkGas && currentInstruction === Instruction.SBRK) {
            const calculateSbrkCost = (length: number) => (alignToPageSize(length) / PAGE_SIZE) * 16;
            const underflow = this.gas.sub(
              tryAsGas(calculateSbrkCost(this.registers.getLowerU32(argsResult.firstRegisterIndex))),
            );
            if (underflow) {
              this.status = Status.OOG;
              return this.status;
            }
          }

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
        case ArgumentType.ONE_REGISTER_ONE_EXTENDED_WIDTH_IMMEDIATE:
          this.oneRegOneExtImmDispatcher.dispatch(currentInstruction, argsResult);
          break;
      }
    }

    if (this.instructionResult.status !== null) {
      // All abnormal terminations should be interpreted as TRAP and we should subtract the gas. In case of FAULT we have to do it manually at the very end.
      if (this.instructionResult.status === Result.FAULT || this.instructionResult.status === Result.FAULT_ACCESS) {
        // TODO [ToDr] underflow?
        this.gas.sub(instructionGasMap[Instruction.TRAP]);
      }

      switch (this.instructionResult.status) {
        case Result.FAULT:
          this.status = Status.FAULT;
          break;
        case Result.HALT:
          this.status = Status.HALT;
          break;
        case Result.PANIC:
        case Result.FAULT_ACCESS:
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

  getGasConsumed(): Gas {
    const gasConsumed = tryAsBigGas(this.initialGas.get()) - tryAsBigGas(this.gas.get());

    if (gasConsumed < 0) {
      return this.initialGas.get();
    }

    return tryAsBigGas(gasConsumed);
  }

  getGasCounter(): GasCounter {
    return this.gas;
  }

  getStatus() {
    return this.status;
  }

  getExitParam(): null | U32 {
    const p = this.instructionResult.exitParam;
    return p !== null ? tryAsU32(p) : p;
  }

  getMemory() {
    return this.memory;
  }

  getMemoryPage(pageNumber: number): null | Uint8Array {
    return this.memory.getPageDump(tryAsPageNumber(pageNumber));
  }
}
