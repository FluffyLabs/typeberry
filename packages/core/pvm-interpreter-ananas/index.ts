import { tryAsU32, tryAsU64, type U64 } from "@typeberry/numbers";
import type { IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import {
  type Gas,
  gasCounter,
  type Memory,
  type Registers,
  Status,
  tryAsBigGas,
  tryAsGas,
  tryAsMemoryIndex,
} from "@typeberry/pvm-interpreter";
import { type OutOfBounds, PageFault } from "@typeberry/pvm-interpreter/memory/errors.js";
import { OK, Result } from "@typeberry/utils";
import {
  disassemble,
  getExitArg,
  getGasLeft,
  getMemory,
  getRegister,
  getStatus,
  HasMetadata,
  InputKind,
  nextStep,
  resetGeneric,
  resetJAM,
  setMemory,
  setNextProgramCounter,
  setRegister,
} from "anan-as";

export class AnanasInterpreter implements IHostCallRegisters, IHostCallMemory {
  private code: number[] = [];
  private pc = 0;
  private initialGas = gasCounter(tryAsGas(0n));
  private kind: InputKind = InputKind.Generic;
  private hasMeta: HasMetadata = HasMetadata.Yes;

  reset(rawProgram: Uint8Array, pc: number, gas: Gas, _maybeRegisters?: Registers, _maybeMemory?: Memory) {
    this.code = this.lowerBytes(rawProgram);
    this.pc = pc;
    this.initialGas = gasCounter(gas);
    if (this.kind === InputKind.SPI) {
      resetJAM(this.code, this.pc, gas as bigint, [], this.hasMeta === HasMetadata.Yes);
    } else {
      resetGeneric(this.code, [], gas as bigint, this.hasMeta === HasMetadata.Yes);
      setNextProgramCounter(this.pc);
    }
  }

  setCode(rawProgram: Uint8Array) {
    this.code = this.lowerBytes(rawProgram);
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

  loadInto(result: Uint8Array, address: U64): Result<OK, PageFault | OutOfBounds> {
    if (result.length === 0) {
      return Result.ok(OK);
    }
    const addr = tryAsU32(Number(address));
    const newResult = getMemory(addr, result.length);
    if (newResult.length === 0) {
      return Result.error(PageFault.fromMemoryIndex(tryAsMemoryIndex(addr)));
    }
    result.set(newResult);
    return Result.ok(OK);
  }

  storeFrom(address: U64, bytes: Uint8Array): Result<OK, PageFault | OutOfBounds> {
    const addr = tryAsU32(Number(address));
    setMemory(addr, bytes);
    return Result.ok(OK);
  }

  get(registerIndex: number): U64 {
    return tryAsU64(getRegister(registerIndex));
  }

  set(registerIndex: number, value: U64): void {
    setRegister(registerIndex, value);
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
