import { Status, tryAsGas } from "@typeberry/pvm-interface";
import { check, safeAllocUint8Array } from "@typeberry/utils";
import { Interpreter } from "./interpreter.js";
import { type Memory, tryAsMemoryIndex } from "./memory/index.js";
import { PAGE_SIZE } from "./memory/memory-consts.js";
import { Registers } from "./registers.js";

export class DebuggerAdapter {
  private readonly pvm: Interpreter;

  constructor(useSbrkGas = false) {
    this.pvm = new Interpreter({ useSbrkGas });
  }

  resetJAM(jamProgram: Uint8Array, pc: number, gas: bigint, args: Uint8Array, hasMetadata = false) {
    this.pvm.resetJam(jamProgram, args, pc, tryAsGas(gas), hasMetadata);
  }

  resetGeneric(rawProgram: Uint8Array, flatRegisters: Uint8Array, initialGas: bigint) {
    this.pvm.resetGeneric(rawProgram, 0, tryAsGas(initialGas), new Registers(flatRegisters));
  }

  reset(rawProgram: Uint8Array, pc: number, gas: bigint, maybeRegisters?: Registers, maybeMemory?: Memory) {
    this.pvm.resetGeneric(rawProgram, pc, tryAsGas(gas), maybeRegisters, maybeMemory);
  }

  getPageDump(pageNumber: number): null | Uint8Array {
    const page = this.pvm.getMemoryPage(pageNumber);

    if (page === null) {
      // page wasn't allocated so we return an empty page
      return safeAllocUint8Array(PAGE_SIZE);
    }

    if (page.length === PAGE_SIZE) {
      // page was allocated and has a proper size so we can simply return it
      return page;
    }

    // page was allocated but it is shorter than PAGE_SIZE so we have to extend it
    const fullPage = safeAllocUint8Array(PAGE_SIZE);
    fullPage.set(page);
    return fullPage;
  }

  setMemory(address: number, value: Uint8Array) {
    this.pvm.memory.storeFrom(tryAsMemoryIndex(address), value);
  }

  getExitArg(): number {
    return this.pvm.getExitParam() ?? 0;
  }

  getStatus(): Status {
    return this.pvm.getStatus();
  }

  nextStep(): boolean {
    return this.pvm.nextStep() === Status.OK;
  }

  nSteps(steps: number): boolean {
    check`${steps >>> 0 > 0} Expected a positive integer got ${steps}`;
    for (let i = 0; i < steps; i++) {
      const isOk = this.nextStep();
      if (!isOk) {
        return false;
      }
    }
    return true;
  }

  getRegisters(): BigUint64Array {
    return this.pvm.registers.getAllU64();
  }

  setRegisters(registers: Uint8Array) {
    this.pvm.registers.copyFrom(new Registers(registers));
  }

  getProgramCounter(): number {
    return this.pvm.getPC();
  }

  setNextProgramCounter(nextPc: number) {
    this.pvm.setNextPC(nextPc);
  }

  getGasLeft(): bigint {
    return BigInt(this.pvm.gas.get());
  }

  setGasLeft(gas: bigint) {
    this.pvm.gas.set(tryAsGas(gas));
  }
}
