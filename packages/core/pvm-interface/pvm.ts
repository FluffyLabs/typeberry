import type { U32 } from "@typeberry/numbers";
import type { IHostCallMemory } from "@typeberry/pvm-host-calls";
import type { Gas, GasCounter } from "./gas.js";
import type { IRegisters } from "./registers.js";
import type { Status } from "./status.js";

export interface IPVMInterpreter {
  resetJam(program: Uint8Array, args: Uint8Array, pc: number, gas: Gas): void;

  runProgram(): void;

  getStatus(): Status;

  getPC(): number;

  getExitParam(): U32 | null;

  getGasCounter(): GasCounter;

  getGasConsumed(): Gas;

  getRegisters(): IRegisters;

  // TODO [MaSo] Make local interface
  getMemory(): IHostCallMemory;
}
