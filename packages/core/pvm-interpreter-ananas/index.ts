import { tryAsU32, tryAsU64, type U64 } from "@typeberry/numbers";
import type { IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { type Gas, gasCounter, Status, tryAsBigGas, tryAsGas, tryAsMemoryIndex } from "@typeberry/pvm-interpreter";
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
  resetJAM,
  setGasLeft,
  setMemory,
  setRegister,
} from "anan-as";

export class AnanasInterpreter implements IHostCallRegisters, IHostCallMemory {
  private pc = 0;
  private initialGas = gasCounter(tryAsGas(0n));

  resetJam(program: Uint8Array, args: Uint8Array, pc: number, gas: Gas) {
    const programArr = lowerBytes(program);
    const argsArr = lowerBytes(args);
    this.pc = pc;
    this.initialGas = gasCounter(gas);
    resetJAM(programArr, this.pc, BigInt(gas), argsArr, true);
  }

  printProgram(program: Uint8Array) {
    return disassemble(lowerBytes(program), InputKind.SPI, HasMetadata.Yes);
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

  setGas(gas: Gas) {
    setGasLeft(gas as bigint);
  }

  subGas(gas: Gas) {
    const newGas = gasCounter(this.getGas());
    const result = newGas.sub(gas);
    setGasLeft(newGas.get() as bigint);
    return result;
  }

  getExitParam() {
    const arg = getExitArg();
    return arg < 0 ? null : tryAsU32(arg);
  }

  getGasConsumed(): Gas {
    const gasConsumed = tryAsBigGas(this.initialGas.get()) - tryAsBigGas(this.getGas());

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
}

/**  Convert `Uint8Array` to `number[]` */
function lowerBytes(data: Uint8Array): number[] {
  const r = new Array<number>(data.length);
  for (let i = 0; i < data.length; i++) {
    r[i] = data[i];
  }
  return r;
}
