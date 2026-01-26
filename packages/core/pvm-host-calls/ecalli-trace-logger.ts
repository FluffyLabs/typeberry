import { BytesBlob } from "@typeberry/bytes";
import { Level, Logger } from "@typeberry/logger";
import type { U32, U64 } from "@typeberry/numbers";
import type { Gas } from "@typeberry/pvm-interface";
import type { IoTracker } from "./ecalli-io-tracker.js";
import type { HostCallIndex } from "./host-call-handler.js";
import type { HostCallRegisters } from "./host-call-registers.js";

const ecalliLogger = Logger.new(import.meta.filename, "ecalli");

/**
 * Output function type for IO trace logging.
 * Each call should output a single line.
 */
export type IoTraceOutput = (line: string) => void;

const defaultOutput: IoTraceOutput = (line) => {
  ecalliLogger.trace`${line}`;
};
const emptyOutput: IoTraceOutput = () => {};

/**
 * Ecalli PVM IO Trace Logger.
 *
 * Implements the logging format specified for PVM execution tracing.
 * This format is designed to be:
 * - Human-readable, newline-delimited text
 * - Self-contained for stateless re-execution
 * - Comparable using simple textual diff tools
 *
 * @see https://github.com/tomusdrw/JIPs/pull/2
 */
export class EcalliTraceLogger {
  /** Returns a tracker for IO operations. */
  tracker(): IoTraceTracker | null {
    return this.output === emptyOutput ? null : new IoTraceTracker();
  }

  /**
   * Create an IoTraceLogger that outputs to the `ecalli` module logger.
   *
   * Returns `null` if the `ecalli` logger is not configured for at least TRACE level.
   * Enable with: `JAM_LOG=ecalli=trace` or `JAM_LOG=trace`
   */
  static create(): EcalliTraceLogger | null {
    if (ecalliLogger.getLevel() > Level.TRACE) {
      return null;
    }

    return EcalliTraceLogger.new(defaultOutput);
  }

  /**
   * Create a no-op IoTraceLogger that discards all output.
   * Used when tracing is disabled.
   */
  static noop(): EcalliTraceLogger {
    return new EcalliTraceLogger(emptyOutput);
  }

  static new(output: IoTraceOutput): EcalliTraceLogger {
    return new EcalliTraceLogger(output);
  }

  private constructor(private readonly output: IoTraceOutput) {}

  /**
   * Log optional context lines (implementation metadata, execution environment).
   */
  logContext(context: string): void {
    this.output(context);
  }

  /**
   * Log the program blob being executed and the write data (if any)
   *
   * Format: `program {hex-encoded-program-with-metadata}`
   * Format: `memwrite {hex-encoded-address} len={blob-byte-length} <- {hex-encoded-bytes}`
   */
  logProgram(program: Uint8Array, args: Uint8Array): void {
    const SPI_ARGS_SEGMENT = 0xfe_ff_00_00;
    this.output(`program ${BytesBlob.blobFrom(program)}`);

    if (args.length > 0) {
      this.output(`memwrite ${toHexAddress(SPI_ARGS_SEGMENT)} len=${args.length} <- ${BytesBlob.blobFrom(args)}`);
    }
  }

  /**
   * Log initial execution state (prelude).
   *
   * Format: `start pc={pc} gas={gas} {register-dump}`
   */
  logStart(pc: number, gas: Gas, registers: HostCallRegisters): void {
    const line = `start pc=${pc} gas=${gas} ${registers}`;
    this.output(line);
  }

  /**
   * Log ecalli invocation with register dump.
   *
   * Format: `ecalli={index} pc={pc} gas={gas} {register-dump}`
   */
  logEcalli(index: HostCallIndex, pc: number, gas: Gas, registers: HostCallRegisters): void {
    const line = `ecalli=${index} pc=${pc} gas=${gas} ${registers}`;
    this.output(line);
  }

  /**
   * Log memory read operation.
   *
   * Format: `memread {hex-encoded-address} len={blob-byte-length} -> {hex-encoded-data-read}`
   */
  logMemRead(address: number, len: number, data: string): void {
    this.output(`memread ${toHexAddress(address)} len=${len} -> ${data}`);
  }

  /**
   * Log memory write operation.
   *
   * Format: `memwrite {hex-encoded-address} len={blob-byte-length} <- {hex-encoded-bytes}`
   */
  logMemWrite(address: number, len: number, data: string): void {
    this.output(`memwrite ${toHexAddress(address)} len=${len} <- ${data}`);
  }

  /**
   * Log register write operation.
   *
   * Format: `setreg r{idx} <- {hex-encoded-value}`
   */
  logSetReg(index: number, value: bigint): void {
    const paddedIdx = index.toString().padStart(2, "0");
    this.output(`setreg r${paddedIdx} <- ${value.toString(16)}`);
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
  logHostActions(ioTracker: IoTraceTracker | null, gasBefore: Gas, gasAfter: Gas): void {
    if (ioTracker === null) {
      return;
    }

    const reads = ioTracker.reads.sort((a, b) => a.address - b.address);
    for (const op of reads) {
      this.logMemRead(op.address, op.len, op.hex);
    }

    const writes = ioTracker.writes.sort((a, b) => a.address - b.address);
    for (const op of writes) {
      this.logMemWrite(op.address, op.len, op.hex);
    }

    const sortedRegWrites = [...ioTracker.registers.entries()].sort((a, b) => a[0] - b[0]);
    for (const op of sortedRegWrites) {
      this.logSetReg(op[0], op[1]);
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
  logPanic(argument: number, pc: number, gas: Gas, registers: HostCallRegisters): void {
    const line = `PANIC=${argument} pc=${pc} gas=${gas} ${registers}`;
    this.output(line);
  }

  /**
   * Log OOG (out of gas) termination.
   *
   * Format: `OOG pc={pc} gas={gas} {register-dump}`
   */
  logOog(pc: number, gas: Gas, registers: HostCallRegisters): void {
    const line = `OOG pc=${pc} gas=${gas} ${registers}`;
    this.output(line);
  }

  /**
   * Log HALT termination.
   *
   * Format: `HALT pc={pc} gas={gas} {register-dump}`
   */
  logHalt(pc: number, gas: Gas, registers: HostCallRegisters): void {
    const line = `HALT pc=${pc} gas=${gas} ${registers}`;
    this.output(line);
  }
}

/**
 * Convert 32-bit address to 0x-prefixed hex string.
 */
function toHexAddress(address: number): string {
  return `0x${address.toString(16).padStart(8, "0")}`;
}

type MemoryOperation = { address: number; hex: string; len: number };

/**
 * IoTracker implementation that records all I/O operations for trace logging.
 *
 * Stores memory reads, writes, and register modifications as hex-encoded strings
 * for output via IoTraceLogger.
 */
export class IoTraceTracker implements IoTracker {
  /** Recorded memory read operations (address + hex data + len). */
  reads: MemoryOperation[] = [];
  /** Recorded memory write operations (address + hex data + len). */
  writes: MemoryOperation[] = [];
  /** Recorded register write operations (index -> value). */
  registers: Map<number, U64> = new Map();

  setReg(idx: number, val: U64): void {
    this.registers.set(idx, val);
  }

  memRead(address: U32, data: Uint8Array): void {
    this.reads.push({ address, hex: BytesBlob.blobFrom(data).toString(), len: data.length });
  }

  memWrite(address: U32, data: Uint8Array): void {
    this.writes.push({ address, hex: BytesBlob.blobFrom(data).toString(), len: data.length });
  }

  clear(): void {
    this.reads.length = 0;
    this.writes.length = 0;
    this.registers.clear();
  }
}
