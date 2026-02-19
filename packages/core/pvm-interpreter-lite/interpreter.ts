import { tryAsU32, type U32 } from "@typeberry/numbers";
import { type Gas, type IGasCounter, type IPvmInterpreter, Status, tryAsGas } from "@typeberry/pvm-interface";
import { Program as OldProgram } from "@typeberry/pvm-interpreter/program.js";
import { buildDispatchTable } from "./dispatch-table.js";
import { createGasCounter } from "./gas.js";
import { Memory } from "./memory.js";
import { Page, PageAccess } from "./page.js";
import { Program } from "./program.js";
import { Registers } from "./registers.js";
import { EXIT_HALT, type InstructionHandler, type InterpreterContext } from "./types.js";

function exitCodeToStatus(code: number): Status {
  // EXIT_HALT=0x1000000 -> 0=HALT, EXIT_PANIC -> 1=PANIC, EXIT_FAULT -> 2=FAULT, EXIT_HOST -> 3=HOST
  return (code - EXIT_HALT) as Status;
}

export interface InterpreterOptions {
  /**
   * When true, forces BigGasCounter regardless of gas value.
   * Required for debugger mode where gas.set() may be called with arbitrary values at runtime.
   * When false (default), uses FastGasCounter for gas <= MAX_SAFE_INTEGER (optimal performance).
   */
  debuggerMode?: boolean;
}

export class Interpreter implements IPvmInterpreter {
  // ---- public (interface) ----
  readonly registers = new Registers();
  readonly memory = new Memory();
  gas: IGasCounter = createGasCounter(tryAsGas(0));

  // ---- internal state ----
  private code: Uint8Array = new Uint8Array(0);
  private skip: Uint8Array = new Uint8Array(0);
  private dispatch: InstructionHandler[] = buildDispatchTable();
  private pc = 0;
  private _nextPc = 0;
  private status = Status.OK;
  private exitParam: number | null = null;
  private ctx: InterpreterContext;
  private readonly forceBigGas: boolean;

  constructor(options?: InterpreterOptions) {
    this.forceBigGas = options?.debuggerMode === true;
    this.ctx = {
      regs: this.registers,
      mem: this.memory,
      blocks: new Uint8Array(0),
      jumpTable: new Uint32Array(0),
      jumpTableSize: 0,
      exitParam: 0,
      nextPc: 0,
      regBuf: new Uint8Array(8),
    };
  }

  resetJam(program: Uint8Array, args: Uint8Array, pc: number, gas: Gas, hasMetadata = true): void {
    const p = OldProgram.fromSpi(program, args, hasMetadata);
    // biome-ignore lint: accessing internal state of old interpreter's classes
    this.resetGenericFromOld(p.code, pc, gas, p.registers, p.memory as any);
  }

  resetGeneric(rawProgram: Uint8Array, pc: number, gas: Gas): void {
    const prog = new Program(rawProgram);

    this.code = prog.code;
    this.skip = prog.skip;
    this.ctx.blocks = prog.blocks;
    this.ctx.jumpTable = prog.jumpTable;
    this.ctx.jumpTableSize = prog.jumpTableSize;

    this.pc = pc;
    this.gas = createGasCounter(gas, this.forceBigGas);
    this.status = Status.OK;
    this.exitParam = null;
    this.ctx.exitParam = 0;
    this.ctx.nextPc = 0;

    this.registers.reset();
    this.memory.reset();
  }

  /**
   * Reset using old-format registers and memory (from SPI decode).
   * This bridges the gap between pvm-interpreter's Program.fromSpi output
   * and our internal representation.
   */
  private resetGenericFromOld(
    rawProgram: Uint8Array,
    pc: number,
    gas: Gas,
    oldRegisters?: { getAllEncoded(): Uint8Array },
    // biome-ignore lint: accessing internal state of old interpreter
    oldMemory?: any,
  ): void {
    const prog = new Program(rawProgram);

    this.code = prog.code;
    this.skip = prog.skip;
    this.ctx.blocks = prog.blocks;
    this.ctx.jumpTable = prog.jumpTable;
    this.ctx.jumpTableSize = prog.jumpTableSize;

    this.pc = pc;
    this.gas = createGasCounter(gas, this.forceBigGas);
    this.status = Status.OK;
    this.exitParam = null;
    this.ctx.exitParam = 0;
    this.ctx.nextPc = 0;

    // Copy registers
    if (oldRegisters !== undefined) {
      this.registers.setAllEncoded(oldRegisters.getAllEncoded());
    } else {
      this.registers.reset();
    }

    // Copy memory from old interpreter's memory
    this.memory.reset();
    if (oldMemory !== undefined && oldMemory !== null) {
      this.copyOldMemory(oldMemory);
    }
  }

  private copyOldMemory(oldMemory: any): void {
    const om = oldMemory;

    // Copy sbrk state
    if (om.sbrkIndex !== undefined && om.endHeapIndex !== undefined) {
      this.memory.setSbrkState(om.sbrkIndex, om.endHeapIndex);
    }

    // Copy pages
    if (om.memory !== undefined && om.memory !== null) {
      for (const [pageNum, page] of om.memory) {
        const dump = page.getPageDump();
        if (page.isWriteable() === true) {
          const buf = this.memory.bufferPool.acquire();
          buf.set(dump.subarray(0, Math.min(dump.length, 4096)));
          this.memory.setPage(pageNum, new Page(buf, PageAccess.READ_WRITE));
        } else {
          // Read-only: reference the data directly (zero-copy)
          this.memory.setPage(pageNum, new Page(dump, PageAccess.READ));
        }
      }
    }
  }

  runProgram(): void {
    // HOST resume
    if (this.status === Status.HOST) {
      this.status = Status.OK;
      this.pc = this._nextPc;
    }

    // Copy hot state to locals (V8 keeps locals in CPU registers)
    const code = this.code;
    const skip = this.skip;
    const dispatch = this.dispatch;
    const gas = this.gas as IGasCounter & { subOne(): boolean };
    const ctx = this.ctx;
    let pc = this.pc;

    for (;;) {
      // Gas (old model: cost=1 per instruction)
      if (gas.subOne()) {
        this.pc = pc;
        this.status = Status.OOG;
        return;
      }

      // Fetch + dispatch
      const opcode = pc < code.length ? code[pc] : 0; // 0 = TRAP -> PANIC
      const result = dispatch[opcode](ctx, pc, code, skip);

      if (result >= EXIT_HALT) {
        // Exit: HALT/PANIC/FAULT/HOST
        this.pc = pc;
        this.status = exitCodeToStatus(result);
        if (this.status === Status.HOST || this.status === Status.FAULT) {
          this.exitParam = ctx.exitParam;
        }
        if (this.status === Status.HOST) {
          this._nextPc = ctx.nextPc;
        }
        return;
      }

      pc = result; // result = next PC
    }
  }

  nextStep(): Status {
    // HOST resume
    if (this.status === Status.HOST) {
      this.status = Status.OK;
      this.pc = this._nextPc;
    }

    if ((this.gas as IGasCounter & { subOne(): boolean }).subOne()) {
      this.status = Status.OOG;
      return this.status;
    }

    const opcode = this.pc < this.code.length ? this.code[this.pc] : 0;
    const result = this.dispatch[opcode](this.ctx, this.pc, this.code, this.skip);

    if (result >= EXIT_HALT) {
      this.status = exitCodeToStatus(result);
      if (this.status === Status.HOST || this.status === Status.FAULT) {
        this.exitParam = this.ctx.exitParam;
      }
      if (this.status === Status.HOST) {
        this._nextPc = this.ctx.nextPc;
      }
      return this.status;
    }

    this.pc = result;
    return Status.OK;
  }

  getPC(): number {
    return this.pc;
  }

  setNextPC(nextPc: number): void {
    this.pc = nextPc;
  }

  getStatus(): Status {
    return this.status;
  }

  getExitParam(): U32 | null {
    return this.exitParam !== null ? tryAsU32(this.exitParam) : null;
  }

  getMemoryPage(pageNumber: number): Uint8Array | null {
    return this.memory.getPageDump(pageNumber);
  }
}
