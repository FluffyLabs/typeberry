import { type U64, tryAsU64 } from "@typeberry/numbers";
import { Interpreter, type Memory } from "@typeberry/pvm-interpreter";
import { tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { PAGE_SIZE } from "@typeberry/pvm-interpreter/memory/memory-consts";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import type { Status } from "@typeberry/pvm-interpreter/status";

export class DebuggerAdapter {
  private readonly pvm: Interpreter;

  constructor() {
    this.pvm = new Interpreter();
  }

  nextStep(): Status {
    return this.pvm.nextStep();
  }

  getRegisters(): Uint32Array {
    return this.pvm.getRegisters().asUnsigned;
  }

  getPC(): number {
    return this.pvm.getPC();
  }

  getGas(): U64 {
    return tryAsU64(this.pvm.getGas());
  }

  getStatus(): Status {
    return this.pvm.getStatus();
  }

  reset(rawProgram: Uint8Array, pc: number, gas: number, maybeRegisters?: Registers, maybeMemory?: Memory) {
    this.pvm.reset(rawProgram, pc, tryAsGas(gas), maybeRegisters, maybeMemory);
  }

  setNextPC(nextPc: number) {
    this.pvm.setNextPC(nextPc);
  }

  setGasLeft(gas: U64) {
    this.pvm.getGasCounter().set(tryAsGas(gas));
  }

  getMemoryPage(pageNumber: number): null | Uint8Array {
    const page = this.pvm.getMemoryPage(pageNumber);

    if (!page) {
      // page wasn't allocated so we return an empty page
      return new Uint8Array(PAGE_SIZE);
    }

    if (page.length === PAGE_SIZE) {
      // page was allocated and has a proper size so we can simply return it
      return page;
    }

    // page was allocated but it is shorter than PAGE_SIZE so we have to extend it
    const fullPage = new Uint8Array(PAGE_SIZE);
    fullPage.set(page);
    return fullPage;
  }
}
