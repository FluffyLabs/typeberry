import { instantiate } from "@fluffylabs/anan-as/raw";
import { Decoder } from "@typeberry/codec";
import { tryAsU32, type U64 } from "@typeberry/numbers";
import type { IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import {
  type Gas,
  type GasCounter,
  gasCounter,
  Status,
  tryAsBigGas,
  tryAsGas,
  tryAsMemoryIndex,
} from "@typeberry/pvm-interpreter";
import { type OutOfBounds, PageFault } from "@typeberry/pvm-interpreter/memory/errors.js";
import { OK, Result } from "@typeberry/utils";
import { load } from "assemblyscript-loader";
import type { AnanasAPI } from "./api.js";

const INF_STEPS = 2 ** 32 - 1;

class AnanasRegisters implements IHostCallRegisters {
  constructor(private readonly instance: AnanasAPI) {}

  get(registerIndex: number): U64 {
    const regs: Uint8Array = this.instance.getRegisters();
    const decoder = Decoder.fromBlob(regs);
    decoder.skip(registerIndex * 8);
    return decoder.u64();
  }

  set(registerIndex: number, value: U64): void {
    const regs: Uint8Array = this.instance.getRegisters();
    const view = new DataView(regs.buffer);
    view.setBigUint64(registerIndex * 8, value, true);
    this.instance.setRegisters(lowerBytes(regs));
  }
}

class AnanasMemory implements IHostCallMemory {
  constructor(private readonly instance: AnanasAPI) {}

  loadInto(result: Uint8Array, address: U64): Result<OK, PageFault | OutOfBounds> {
    if (result.length === 0) {
      return Result.ok(OK);
    }
    const addr = tryAsU32(Number(address));
    const newResult = this.instance.getMemory(addr, result.length);
    if (newResult.length === 0) {
      return Result.error(PageFault.fromMemoryIndex(tryAsMemoryIndex(addr)));
    }
    result.set(newResult);
    return Result.ok(OK);
  }

  storeFrom(address: U64, bytes: Uint8Array): Result<OK, PageFault | OutOfBounds> {
    const addr = tryAsU32(Number(address));
    this.instance.setMemory(addr, bytes);
    return Result.ok(OK);
  }
}

class AnanasGasCounter implements GasCounter {
  constructor(private readonly instance: AnanasAPI) {}

  get(): Gas {
    return tryAsGas(this.instance.getGasLeft());
  }

  set(g: Gas): void {
    this.instance.setGasLeft(g as bigint);
  }

  sub(g: Gas): boolean {
    const newGas = gasCounter(this.get());
    const result = newGas.sub(g);
    this.set(newGas.get());
    return result;
  }
}

export class AnanasInterpreter {
  private initialGas = gasCounter(tryAsGas(0n));
  private registers: AnanasRegisters;
  private memory: AnanasMemory;
  private gas: AnanasGasCounter;

  private constructor(private readonly instance: AnanasAPI) {
    this.registers = new AnanasRegisters(instance);
    this.memory = new AnanasMemory(instance);
    this.gas = new AnanasGasCounter(instance);
  }

  static async new() {
    const wasmModule = await load("../../../node_modules/@fluffylabs/anan-as/build/release.wasm");
    const instance: AnanasAPI = await instantiate(wasmModule, { env: {} });
    return new AnanasInterpreter(instance);
  }

  resetJam(program: Uint8Array, args: Uint8Array, pc: number, gas: Gas) {
    const programArr = lowerBytes(program);
    const argsArr = lowerBytes(args);
    this.initialGas = gasCounter(gas);
    this.instance.resetJAM(programArr, pc, BigInt(gas), argsArr, true);
  }

  runProgram() {
    // NOTE Setting max value u32 in nNextSteps making ananas running until finished
    // without comming back and forth between JS <-> WASM
    while (this.instance.nSteps(INF_STEPS)) {}
  }

  getStatus() {
    const status = this.instance.getStatus();
    if (status < 0) {
      return Status.OK;
    }
    return status;
  }

  getPC() {
    return this.instance.getProgramCounter();
  }

  getExitParam() {
    const param = this.instance.getExitArg();
    if (param === 0) {
      return null;
    }
    return tryAsU32(param);
  }

  getGasCounter(): GasCounter {
    return this.gas;
  }

  getGasConsumed(): Gas {
    const gasConsumed = tryAsBigGas(this.initialGas.get()) - tryAsBigGas(this.gas.get());

    if (gasConsumed < 0) {
      return this.initialGas.get();
    }

    return tryAsBigGas(gasConsumed);
  }

  getRegisters(): IHostCallRegisters {
    return this.registers;
  }

  getMemory(): IHostCallMemory {
    return this.memory;
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
