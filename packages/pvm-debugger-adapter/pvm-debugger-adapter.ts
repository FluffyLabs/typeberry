import { Pvm } from "@typeberry/pvm";
import { PAGE_SIZE } from "@typeberry/pvm/memory/memory-consts";

export class PvmDebuggerAdapter {
  private pvm: Pvm;

  constructor(...args: ConstructorParameters<typeof Pvm>) {
    this.pvm = new Pvm(...args);
  }

  runProgram() {
    return this.pvm.runProgram();
  }

  nextStep() {
    return this.pvm.nextStep();
  }

  getRegisters() {
    return this.pvm.getRegisters();
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

  getMemoryPage(pageNumber: number): null | Uint8Array {
    const page = this.pvm.getMemoryPage(pageNumber);

    if (!page) {
      return new Uint8Array(PAGE_SIZE);
    }

    if (page.length === PAGE_SIZE) {
      return page;
    }

    const fullPage = new Uint8Array(PAGE_SIZE);
    fullPage.set(page);
    return fullPage;
  }
}
