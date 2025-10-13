import type { Gas, IPvmMemory, IPvmRegisters, PvmStatus } from "./type.js";

export * from "./type.js";

export interface IPvmInterpreter {
  /**
   * Reset interpreter with new program.
   */
  reset(program: Uint8Array, pc: number, gas: Gas, registers?: IPvmRegisters, memory?: IPvmMemory): void;

  /**
   * Execute one instruction.
   */
  nextStep(): PvmStatus;

  /**
   * Run program.
   */
  runProgram(): PvmStatus;

  /**
   * Get current execution status.
   */
  getStatus(): PvmStatus;

  /**
   * Get current gas.
   */
  getGas(): Gas;

  /**
   * Get current program counter.
   */
  getPC(): number;

  /**
   * Get current registers.
   */
  getRegisters(): IPvmRegisters;

  /**
   * Get current memory.
   */
  getMemory(): IPvmMemory;

  /**
   * Print disassemlbed program.
   */
  printProgram(): string[];

  /**
   * Cleanup resources.
   */
  destroy(): void;
}
