import { disassemble, getExitArg, getGasLeft, getRegisters, getStatus, nextStep, prepareProgram, resetGenericWithMemory, resetJAM, runProgram, setNextProgramCounter } from "anan-as";
import { InputKind, HasMetadata } from "anan-as";
import { Status, Registers, tryAsGas, Memory, gasCounter, Gas, tryAsBigGas } from "@typeberry/pvm-interpreter";

export class AnanasInterpreter {
  private code: number[] = [];
  private pc = 0;
  private initialGas = gasCounter(tryAsGas(0n));
  private kind: InputKind = InputKind.SPI;
  private hasMeta: HasMetadata = HasMetadata.No;

  reset(rawProgram: Uint8Array, pc: number, gas: Gas, _maybeRegisters?: Registers, _maybeMemory?: Memory) {
    this.code = this.lowerBytes(rawProgram);
    this.pc = pc;
    this.initialGas = gasCounter(gas);
    resetGenericWithMemory(this.code, [], new Uint8Array(), new Uint8Array(), gas as bigint, this.hasMeta === HasMetadata.Yes);
    setNextProgramCounter(this.pc);
  }

  printProgram() {
    return disassemble(this.code, this.kind, this.hasMeta);
  }

  runProgram() {
    while(nextStep());
  }

  getStatus() {
    const status = getStatus();
    if (status < 0) {
      return Status.OK;
    } else {
      return status;
    }
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
