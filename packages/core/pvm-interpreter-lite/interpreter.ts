import { tryAsU32, type U32 } from "@typeberry/numbers";
import { type Gas, type IGasCounter, type IPvmInterpreter, Status, tryAsGas } from "@typeberry/pvm-interface";
import { buildDispatchTable } from "./dispatch-table.js";
import { createGasCounter } from "./gas.js";
import { Memory } from "./memory.js";
import { Page, PageAccess } from "./page.js";
import { DecodeBufs, decodeProgram } from "./program.js";
import { Registers } from "./registers.js";
import { decodeSpi } from "./spi-decoder.js";
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
  private readonly decodeBufs = new DecodeBufs();

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

  resetJam(spi: Uint8Array, args: Uint8Array, pc: number, gas: Gas, _hasMetadata = true): void {
    const spiData = decodeSpi(spi, args);

    const prog = decodeProgram(spiData.code);
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
    for (let i = 0; i < spiData.registers.length; i++) {
      this.registers.setU64(i, spiData.registers[i]);
    }

    this.memory.reset();
    this.memory.setSbrkState(spiData.sbrkIndex, spiData.heapEnd);

    for (const seg of spiData.readonlySegments) {
      this.setMemorySegment(seg, PageAccess.READ);
    }
    for (const seg of spiData.writeableSegments) {
      this.setMemorySegment(seg, PageAccess.READ_WRITE);
    }
  }

  private setMemorySegment(seg: { start: number; end: number; data: Uint8Array | null }, access: PageAccess): void {
    if (seg.data !== null && seg.data.length > 0) {
      let offset = 0;
      let addr = seg.start;
      while (addr < seg.end && offset < seg.data.length) {
        const pageNum = addr >>> 12;
        const pageOffset = addr & 0xfff;
        const toCopy = Math.min(4096 - pageOffset, seg.data.length - offset);
        let page = this.memory.getPage(pageNum);
        if (page === undefined) {
          const buf = this.memory.bufferPool.acquire();
          if (seg.data !== null) {
            buf.set(seg.data.subarray(offset, offset + toCopy), pageOffset);
          }
          this.memory.setPage(pageNum, new Page(buf, access));
        } else {
          if (access === PageAccess.READ_WRITE && !(page.access & 2)) {
            const buf = this.memory.bufferPool.acquire();
            buf.set(page.data);
            page = new Page(buf, access);
            this.memory.setPage(pageNum, page);
          }
          if (seg.data !== null) {
            page.data.set(seg.data.subarray(offset, offset + toCopy), pageOffset);
          }
        }
        offset += toCopy;
        addr += toCopy;
      }
    } else {
      for (let addr = seg.start; addr < seg.end; addr += 4096) {
        const pageNum = addr >>> 12;
        if (this.memory.getPage(pageNum) === undefined) {
          const buf = this.memory.bufferPool.acquire();
          this.memory.setPage(pageNum, new Page(buf, access));
        }
      }
    }
  }

  resetGeneric(rawProgram: Uint8Array, pc: number, gas: Gas): void {
    const prog = decodeProgram(rawProgram, this.decodeBufs);

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
