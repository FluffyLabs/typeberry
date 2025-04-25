import type { BytesBlob } from "@typeberry/bytes";
import type { ProgramCounter } from "@typeberry/jam-host-calls/refine/refine-externalities";
import { type BigGas, Interpreter, type Memory, type Registers } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status";
import type { MachineResult } from "./machine-types";

/**
 * Machine - integrated PVM type
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/2d58002d5800?v=0.6.4
 */
export class MachineInstance {
  /** Program code */
  code: BytesBlob;
  /** Memory - RAM */
  memory: Memory | null;
  /** Program counter - entry point */
  entrypoint: ProgramCounter;

  private constructor(code: BytesBlob, memory: Memory | null, entrypoint: ProgramCounter) {
    this.code = code;
    this.memory = memory;
    this.entrypoint = entrypoint;
  }

  static withCodeAndProgramCounter(code: BytesBlob, entrypoint: ProgramCounter): MachineInstance {
    return new MachineInstance(code, null, entrypoint);
  }

  /** Execute the machine with given gas and registers. */
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
