import { type Memory, Pvm } from "@typeberry/pvm-interpreter";
import { PAGE_SIZE } from "@typeberry/pvm-interpreter/memory/memory-consts";
import type { Registers } from "@typeberry/pvm-interpreter/registers";

export class DebuggerAdapter {
  private pvm: Pvm;

  constructor(...args: ConstructorParameters<typeof Pvm>) {
    this.pvm = new Pvm(...args);
  }

  nextStep() {
    return this.pvm.nextStep();
  }

  getRegisters() {
    return this.pvm.getRegisters().asUnsigned;
  }

  getPC() {
    return this.pvm.getPC();
  }

  getGas() {
    return this.pvm.getGas();
  }

  getStatus() {
    return this.pvm.getStatus();
  }

  reset(rawProgram: Uint8Array, pc: number, gas: number, maybeRegisters?: Registers, maybeMemory?: Memory) {
    this.pvm.reset(rawProgram, pc, gas, maybeRegisters, maybeMemory);
  }

  resume(nextPc: number, gas: number) {
    this.pvm.resume(nextPc, gas);
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
