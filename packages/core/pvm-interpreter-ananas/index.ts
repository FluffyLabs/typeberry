import { instantiate } from "@fluffylabs/anan-as/raw";
import { Decoder } from "@typeberry/codec";
import { tryAsU32, type U32, type U64 } from "@typeberry/numbers";
import {
  type Gas,
  type IGasCounter,
  type IMemory,
  type IRegisters,
  type PageFault,
  Status,
  tryAsBigGas,
  tryAsGas,
} from "@typeberry/pvm-interface";
import { OK, Result } from "@typeberry/utils";
import { load } from "assemblyscript-loader";
import type { AnanasAPI } from "./api.js";

// Max u32 value
const INF_STEPS = 2 ** 32 - 1;

class AnanasRegisters implements IRegisters {
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

class AnanasMemory implements IMemory {
  constructor(private readonly instance: AnanasAPI) {}

  storeFrom(address: U32, bytes: Uint8Array): Result<OK, PageFault> {
    try {
      this.instance.setMemory(address, bytes);
    } catch {
      return Result.error({ address }, () => "Memory is inaccessible!");
    }
    return Result.ok(OK);
  }

  loadInto(address: U32, result: Uint8Array): Result<OK, PageFault> {
    if (result.length === 0) {
      return Result.ok(OK);
    }
    const addr = tryAsU32(Number(address));
    const newResult = this.instance.getMemory(addr, result.length);
    if (newResult.length === 0) {
      return Result.error({ address: addr }, () => "Memory is inaccessible!");
    }
    result.set(newResult);
    return Result.ok(OK);
  }
}

class AnanasGasCounter implements IGasCounter {
  initialGas: Gas = tryAsGas(0n);

  constructor(private readonly instance: AnanasAPI) {}

  get(): Gas {
    return tryAsGas(this.instance.getGasLeft());
  }

  set(g: Gas): void {
    this.instance.setGasLeft(g as bigint);
  }

  sub(g: Gas): boolean {
    const result = this.instance.getGasLeft() - (g as bigint);
    if (result >= 0n) {
      this.instance.setGasLeft(result);
      return false;
    }
    this.instance.setGasLeft(0n);
    return true;
  }

  used(): Gas {
    const gasConsumed = (this.initialGas as bigint) - (this.get() as bigint);

    if (gasConsumed < 0) {
      return this.initialGas;
    }

    return tryAsBigGas(gasConsumed);
  }
}

export class AnanasInterpreter {
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

  resetJam(program: Uint8Array, args: Uint8Array, pc: number, gas: Gas): void {
    const programArr = lowerBytes(program);
    const argsArr = lowerBytes(args);
    this.gas.initialGas = gas;
    this.instance.resetJAM(programArr, pc, gas as bigint, argsArr, true);
  }

  runProgram(): void {
    // NOTE Setting max value u32 in nNextSteps making ananas running until finished
    // without comming back and forth between JS <-> WASM
    while (this.instance.nSteps(INF_STEPS)) {}
  }

  getStatus(): Status {
    const status = this.instance.getStatus();
    if (status < 0) {
      return Status.OK;
    }
    return status as Status;
  }

  getPC(): number {
    return this.instance.getProgramCounter();
  }

  getExitParam(): U32 | null {
    const param = this.instance.getExitArg();
    if (param < 0) {
      return null;
    }
    return tryAsU32(param);
  }

  getGasCounter(): IGasCounter {
    return this.gas;
  }

  getRegisters(): IRegisters {
    return this.registers;
  }

  getMemory(): IMemory {
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
