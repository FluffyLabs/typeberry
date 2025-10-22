import type { U32 } from "@typeberry/numbers";
import type { Gas, IGasCounter } from "./gas.js";
import type { IMemory } from "./memory.js";
import type { IRegisters } from "./registers.js";
import type { Status } from "./status.js";

export interface IPVMInterpreter {
  /** Prepare SPI program to be executed. */
  resetJam(program: Uint8Array, args: Uint8Array, pc: number, gas: Gas): void;

  /** Execute loaded program. */
  runProgram(): void;

  /** Get current Status. */
  getStatus(): Status;

  /** Get current Program Counter. */
  getPC(): number;

  /** Get exit args. Needed in case of HOST or FAULT. */
  getExitParam(): U32 | null;

  /** Manipulate gas. */
  getGas(): IGasCounter;

  /** Manipulate registers. */
  getRegisters(): IRegisters;

  /** Manipulate memory. */
  getMemory(): IMemory;
}
