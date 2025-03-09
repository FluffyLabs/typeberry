import { Interpreter, type Memory, tryAsMemoryIndex } from "@typeberry/pvm-interpreter";
import { tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { PAGE_SIZE } from "@typeberry/pvm-interpreter/memory/memory-consts";
import { Registers } from "@typeberry/pvm-interpreter/registers";
import { Status } from "@typeberry/pvm-interpreter/status";
import { check } from "@typeberry/utils";

export class DebuggerAdapter {
  private readonly pvm: Interpreter;

  constructor(useSbrkGas = false) {
    this.pvm = new Interpreter(useSbrkGas);
  }

  // TODO [MaSi]: a temporary solution that is needed to implement host calls in PVM debugger
  getInterpreter() {
    return this.pvm;
  }

  resetGeneric(rawProgram: Uint8Array, flatRegisters: Uint8Array, initialGas: bigint) {
    this.pvm.reset(rawProgram, 0, tryAsGas(initialGas), new Registers(flatRegisters));
  }

  reset(rawProgram: Uint8Array, pc: number, gas: bigint, maybeRegisters?: Registers, maybeMemory?: Memory) {
    this.pvm.reset(rawProgram, pc, tryAsGas(gas), maybeRegisters, maybeMemory);
  }

  getPageDump(pageNumber: number): null | Uint8Array {
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

  setMemory(address: number, value: Uint8Array) {
    this.pvm.getMemory().storeFrom(tryAsMemoryIndex(address), value);
  }

  getExitArg(): number {
    return this.pvm.getExitParam() || 0;
  }

  getStatus(): Status {
    return this.pvm.getStatus();
  }

  nextStep(): boolean {
    return this.pvm.nextStep() === Status.OK;
  }

  nSteps(steps: number): boolean {
    check(steps >>> 0 > 0, `Expected a positive integer got ${steps}`);
    for (let i = 0; i < steps; i++) {
      const isOk = this.nextStep();
      if (!isOk) {
        return false;
      }
    }
    return true;
  }

  getRegisters(): BigUint64Array {
    return this.pvm.getRegisters().getAllU64();
  }

  setRegisters(registers: Uint8Array) {
    this.pvm.getRegisters().copyFrom(new Registers(registers));
  }

  getProgramCounter(): number {
    return this.pvm.getPC();
  }

  setNextProgramCounter(nextPc: number) {
    this.pvm.setNextPC(nextPc);
  }

  getGasLeft(): bigint {
    return BigInt(this.pvm.getGas());
  }

  setGasLeft(gas: bigint) {
    this.pvm.getGasCounter().set(tryAsGas(gas));
  }
}
