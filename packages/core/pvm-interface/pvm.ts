import type { U32 } from "@typeberry/numbers";
import type { Gas, IGasCounter } from "./gas.js";
import type { IMemory } from "./memory.js";
import type { IRegisters } from "./registers.js";
import type { Status } from "./status.js";

export interface IPVMInterpreter {
  resetJam(program: Uint8Array, args: Uint8Array, pc: number, gas: Gas): void;

  runProgram(): void;

  getStatus(): Status;

  getPC(): number;

  getExitParam(): U32 | null;

  getGasCounter(): IGasCounter;

  getRegisters(): IRegisters;

  // TODO [MaSo] Make local interface
  getMemory(): IMemory;
}
