import type { BytesBlob } from "@typeberry/bytes";
import type { ProgramCounter } from "@typeberry/jam-host-calls/refine/refine-externalities";
import { type BigGas, Interpreter, type Memory, MemoryIndex, type Registers } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status";
import type { MachineResult } from "./machine-types";
import { U32 } from "@typeberry/numbers";

/**
 * Machine - integrated PVM type
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/2d58002d5800?v=0.6.4
 */
export interface MachineInstance {
  /** Program code */
  code: BytesBlob;
  /** Memory - RAM */
  memory: Memory | null;
  /** Program counter - entry point */
  entrypoint: ProgramCounter;

  /** Getters and setters for memory. */
  peek(address: MemoryIndex, length: U32): Promise<BytesBlob>;
  poke(address: MemoryIndex, length: U32): Promise<boolean>;

  /** Initial memory - set all bytes to zero */
  initialMemory(): Promise<boolean>;

  /** Mark pages as unavailable and zero their content. */
  voidMemory(): Promise<boolean>;

  /** Execute the machine with given gas and registers. */
  run(gas: BigGas, registers: Registers): Promise<MachineResult>;
}

export class MachineInterpreter implements MachineInstance {
  readonly code: BytesBlob;
  readonly memory: Memory | null;
  readonly entrypoint: ProgramCounter;

  private constructor(code: BytesBlob, entrypoint: ProgramCounter, memory: Memory | null) {
    this.code = code;
    this.entrypoint = entrypoint;
    this.memory = memory;
  }

  static new(code: BytesBlob, entrypoint: ProgramCounter): MachineInterpreter {
    return new MachineInterpreter(code, entrypoint, null);
  }

  getMemory(): Memory {
    throw new Error("Method not implemented.");
  }
  setMemory(): void {
    throw new Error("Method not implemented.");
  }
  zeroMemory(): void {
    throw new Error("Method not implemented.");
  }
  voidMemory(): void {
    throw new Error("Method not implemented.");
  }

  async run(gas: BigGas, registers: Registers): Promise<MachineResult> {
    if (this.memory === null) {
      throw new Error("Memory is not initialized");
    }

    const interpreter = new Interpreter();
    /** TODO [MaSo] Can it be over 2^32? */
    interpreter.reset(this.code.raw, Number(this.entrypoint), gas, registers, this.memory);
    interpreter.runProgram();

    return {
      result: {
        status: Status.OK,
      },
      gas,
      registers,
    };
  }
}
