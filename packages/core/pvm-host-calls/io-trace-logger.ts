import type { Gas } from "@typeberry/pvm-interface";
import type { HostCallIndex } from "./host-call-handler.js";

/**
 * Memory operation recorded during host call execution.
 */
export type MemoryOperation =
  | { type: "read"; address: number; data: Uint8Array }
  | { type: "write"; address: number; data: Uint8Array };

/**
 * Register write operation recorded during host call execution.
 */
export interface RegisterWriteOperation {
  index: number;
  value: bigint;
}

/**
 * Output function type for IO trace logging.
 * Each call should output a single line.
 */
export type IoTraceOutput = (line: string) => void;

/**
 * JIP-6 PVM IO Trace Logger.
 *
 * Implements the logging format specified in JIP-6 for PVM execution tracing.
 * This format is designed to be:
 * - Human-readable, newline-delimited text
 * - Self-contained for stateless re-execution
 * - Comparable using simple textual diff tools
 *
 * @see https://github.com/polkadot-fellows/JIPs/blob/main/JIP-6.md
 */
export class IoTraceLogger {
  constructor(private readonly output: IoTraceOutput) {}

  /**
   * Log optional context lines (implementation metadata, execution environment).
   */
  logContext(context: string): void {
    this.output(context);
  }

  /**
   * Log the program blob being executed.
   *
   * Format: `program {hex-encoded-program-with-metadata}`
   */
  logProgram(program: Uint8Array): void {
    this.output(`program ${toHex(program)}`);
  }

  /**
   * Log initial memory write (prelude).
   *
   * Format: `memwrite {hex-encoded-address} len={blob-byte-length} <- {hex-encoded-bytes}`
   */
  logInitialMemWrite(address: number, data: Uint8Array): void {
    this.output(`memwrite ${toHexAddress(address)} len=${data.length} <- ${toHex(data)}`);
  }

  /**
   * Log initial execution state (prelude).
   *
   * Format: `start pc={pc} gas={gas} {register-dump}`
   */
  logStart(pc: number, gas: Gas, registers: Map<number, bigint>): void {
    const regDump = formatRegisterDump(registers);
    const line = `start pc=${pc} gas=${gas}${regDump !== "" ? ` ${regDump}` : ""}`;
    this.output(line);
  }

  /**
   * Log ecalli invocation with register dump.
   *
   * Format: `ecalli={index} pc={pc} gas={gas} {register-dump}`
   */
  logEcalli(index: HostCallIndex, pc: number, gas: Gas, registers: Map<number, bigint>): void {
    const regDump = formatRegisterDump(registers);
    const line = `ecalli=${index} pc=${pc} gas=${gas}${regDump !== "" ? ` ${regDump}` : ""}`;
    this.output(line);
  }

  /**
   * Log memory read operation.
   *
   * Format: `memread {hex-encoded-address} len={blob-byte-length} -> {hex-encoded-data-read}`
   */
  logMemRead(address: number, data: Uint8Array): void {
    this.output(`memread ${toHexAddress(address)} len=${data.length} -> ${toHex(data)}`);
  }

  /**
   * Log memory write operation.
   *
   * Format: `memwrite {hex-encoded-address} len={blob-byte-length} <- {hex-encoded-bytes}`
   */
  logMemWrite(address: number, data: Uint8Array): void {
    this.output(`memwrite ${toHexAddress(address)} len=${data.length} <- ${toHex(data)}`);
  }

  /**
   * Log register write operation.
   *
   * Format: `setreg r{idx} <- {hex-encoded-value}`
   */
  logSetReg(index: number, value: bigint): void {
    const paddedIdx = index.toString().padStart(2, "0");
    this.output(`setreg r${paddedIdx} <- ${toHexValue(value)}`);
  }

  /**
   * Log gas overwrite operation.
   *
   * Format: `setgas <- {gas}`
   */
  logSetGas(gas: Gas): void {
    this.output(`setgas <- ${gas}`);
  }

  /**
   * Log all host actions from a single ecalli invocation.
   * Actions are logged in the order specified by JIP-6:
   * 1. Memory reads (sorted by address)
   * 2. Memory writes (sorted by address)
   * 3. Register writes (sorted by index)
   * 4. Gas overwrite
   */
  logHostActions(
    memoryOps: MemoryOperation[],
    registerWrites: RegisterWriteOperation[],
    gasBefore: Gas,
    gasAfter: Gas,
  ): void {
    const reads = memoryOps.filter((op) => op.type === "read").sort((a, b) => a.address - b.address);
    for (const op of reads) {
      this.logMemRead(op.address, op.data);
    }

    const writes = memoryOps.filter((op) => op.type === "write").sort((a, b) => a.address - b.address);
    for (const op of writes) {
      this.logMemWrite(op.address, op.data);
    }

    const sortedRegWrites = [...registerWrites].sort((a, b) => a.index - b.index);
    for (const op of sortedRegWrites) {
      this.logSetReg(op.index, op.value);
    }

    if (gasBefore !== gasAfter) {
      this.logSetGas(gasAfter);
    }
  }

  /**
   * Log PANIC termination.
   *
   * Format: `PANIC={argument} pc={pc} gas={gas} {register-dump}`
   */
  logPanic(argument: number, pc: number, gas: Gas, registers: Map<number, bigint>): void {
    const regDump = formatRegisterDump(registers);
    const line = `PANIC=${argument} pc=${pc} gas=${gas}${regDump !== "" ? ` ${regDump}` : ""}`;
    this.output(line);
  }

  /**
   * Log OOG (out of gas) termination.
   *
   * Format: `OOG pc={pc} gas={gas} {register-dump}`
   */
  logOog(pc: number, gas: Gas, registers: Map<number, bigint>): void {
    const regDump = formatRegisterDump(registers);
    const line = `OOG pc=${pc} gas=${gas}${regDump !== "" ? ` ${regDump}` : ""}`;
    this.output(line);
  }

  /**
   * Log HALT termination.
   *
   * Format: `HALT pc={pc} gas={gas} {register-dump}`
   */
  logHalt(pc: number, gas: Gas, registers: Map<number, bigint>): void {
    const regDump = formatRegisterDump(registers);
    const line = `HALT pc=${pc} gas=${gas}${regDump !== "" ? ` ${regDump}` : ""}`;
    this.output(line);
  }
}

/**
 * Convert bytes to lowercase hex string with 0x prefix.
 */
function toHex(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return "0x";
  }
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Convert 32-bit address to 0x-prefixed hex string.
 */
function toHexAddress(address: number): string {
  return `0x${address.toString(16).padStart(8, "0")}`;
}

/**
 * Convert 64-bit value to 0x-prefixed hex string with no padding and leading zeros trimmed.
 */
function toHexValue(value: bigint): string {
  if (value === 0n) {
    return "0x0";
  }
  return `0x${value.toString(16)}`;
}

/**
 * Format register dump as space-delimited list of r{idx}={value} pairs.
 * Only includes non-zero registers.
 * Register indices are 0-padded decimal values sorted ascending.
 * Values are 0x-prefixed 64-bit hex with no padding and leading zeros trimmed.
 */
function formatRegisterDump(registers: Map<number, bigint>): string {
  const entries = Array.from(registers.entries())
    .filter(([, value]) => value !== 0n)
    .sort((a, b) => a[0] - b[0])
    .map(([idx, value]) => `r${idx.toString().padStart(2, "0")}=${toHexValue(value)}`);

  return entries.join(" ");
}

/**
 * Extract non-zero registers from HostCallRegisters into a Map.
 */
export function extractRegisters(getRegister: (index: number) => bigint, count = 13): Map<number, bigint> {
  const result = new Map<number, bigint>();
  for (let i = 0; i < count; i++) {
    const value = getRegister(i);
    if (value !== 0n) {
      result.set(i, value);
    }
  }
  return result;
}
