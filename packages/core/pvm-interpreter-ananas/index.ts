import { type Gas, gasCounter, Memory, Registers, Status, tryAsBigGas, tryAsGas } from "@typeberry/pvm-interpreter";
import {
  disassemble,
  getExitArg,
  getGasLeft,
  getRegisters,
  getStatus,
  HasMetadata,
  InputKind,
  nextStep,
  resetGenericWithMemory,
  setNextProgramCounter,
} from "anan-as";

export class AnanasInterpreter {
  private code: number[] = [];
  private pc = 0;
  private initialGas = gasCounter(tryAsGas(0n));
  private kind: InputKind = InputKind.SPI;
  private hasMeta: HasMetadata = HasMetadata.No;

  reset(rawProgram: Uint8Array, pc: number, gas: Gas, maybeRegisters?: Registers, _maybeMemory?: Memory) {
    this.code = this.lowerBytes(rawProgram);
    this.pc = pc;
    this.initialGas = gasCounter(gas);
    let regs: number[] = [];
    if (maybeRegisters !== undefined) {
      regs = this.lowerBytes(maybeRegisters.getAllBytesAsLittleEndian());
    }
    const pages = new Uint8Array();
    const chunks = new Uint8Array();
    // TODO [MaSo] Set memory
    resetGenericWithMemory(this.code, regs, pages, chunks, gas as bigint, this.hasMeta === HasMetadata.Yes);
    setNextProgramCounter(this.pc);
  }

  printProgram() {
    return disassemble(this.code, this.kind, this.hasMeta);
  }

  runProgram() {
    while (nextStep()) {}
  }

  getStatus() {
    const status = getStatus();
    if (status < 0) {
      return Status.OK;
    }
    return status;
  }

  getPC() {
    return this.pc;
  }

  getGas() {
    return tryAsGas(getGasLeft());
  }

  getGasCounter() {
    return gasCounter(this.getGas());
  }

  getRegisters() {
    return Registers.fromBytes(getRegisters());
  }

  // TODO [MaSo] Implement
  getMemory() {
    return new Memory();
  }

  getExitParam() {
    return getExitArg();
  }

  getGasConsumed(): Gas {
    const gasConsumed = tryAsBigGas(this.initialGas.get()) - tryAsBigGas(this.getGasCounter().get());

    if (gasConsumed < 0) {
      return this.initialGas.get();
    }

    return tryAsBigGas(gasConsumed);
  }

  /**  Convert `Uint8Array` to `number[]` */
  private lowerBytes(data: Uint8Array): number[] {
    const r = new Array<number>(data.length);
    for (let i = 0; i < data.length; i++) {
      r[i] = data[i];
    }
    return r;
  }
}
