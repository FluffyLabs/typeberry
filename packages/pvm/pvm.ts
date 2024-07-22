import { ArgsDecoder } from "./args-decoder/args-decoder";
import { ArgumentType } from "./args-decoder/argument-type";
import { assemblify } from "./assemblify";
import { Instruction } from "./instruction";
import { instructionGasMap } from "./instruction-gas-map";
import { BitOps, MathOps, ShiftOps } from "./ops";
import { ThreeRegsDispatcher, TwoRegsOneImmDispatcher } from "./ops-dispatchers";
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
  private pc = 0;
  private registers = new Registers();
  private mathOps = new MathOps(this.registers);
  private shiftOps = new ShiftOps(this.registers);
  private bitOps = new BitOps(this.registers);
  private gas: number;
  private pageMap: PageMapItem[];
  private memory: MemoryChunkItem[];
  private status: "trap" | "halt" = "trap";
  private argsDecoder: ArgsDecoder;
  private code: Uint8Array;
  private mask: Mask;
  private threeRegsDispatcher: ThreeRegsDispatcher;
  private twoRegsOneImmDispatcher: TwoRegsOneImmDispatcher;

  constructor(rawProgram: Uint8Array, initialState: InitialState = {}) {
    const programDecoder = new ProgramDecoder(rawProgram);
    this.code = programDecoder.getCode();
    this.mask = programDecoder.getMask();

    this.pc = initialState.pc ?? 0;

    for (let i = 0; i < NO_OF_REGISTERS; i++) {
      this.registers.asUnsigned[i] = initialState.regs?.[i] ?? 0;
    }
    this.gas = initialState.gas ?? 0;
    this.pageMap = initialState.pageMap ?? [];
    this.memory = initialState.memory ?? [];
    this.argsDecoder = new ArgsDecoder(this.code, this.mask);
    const mathOps = new MathOps(this.registers);
    const shiftOps = new ShiftOps(this.registers);
    const bitOps = new BitOps(this.registers);

    this.threeRegsDispatcher = new ThreeRegsDispatcher(mathOps, shiftOps, bitOps);
    this.twoRegsOneImmDispatcher = new TwoRegsOneImmDispatcher(mathOps, shiftOps, bitOps);
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
        // TODO [MaSi]: to handle
      }
      const args = this.argsDecoder.getArgs(this.pc);

      switch (args.type) {
        case ArgumentType.NO_ARGUMENTS:
          if (currentInstruction === Instruction.TRAP) {
            this.status = "trap";
            return;
          }
          break;
        case ArgumentType.THREE_REGISTERS:
          this.threeRegsDispatcher.disptach(currentInstruction, args);
          break;
        case ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE:
          this.twoRegsOneImmDispatcher.dispatch(currentInstruction, args);
          break;
      }

      this.pc += args.noOfInstructionsToSkip;
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
      pageMap: this.pageMap,
      memory: this.memory,
      status: this.status,
    };
  }
}
