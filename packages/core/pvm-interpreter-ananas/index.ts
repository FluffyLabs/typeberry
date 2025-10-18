import { instantiate } from "@fluffylabs/anan-as/raw";
import { Decoder } from "@typeberry/codec";
import { tryAsU32, type U32, type U64 } from "@typeberry/numbers";
import type { IHostCallMemory } from "@typeberry/pvm-host-calls";
import { type Gas, type GasCounter, type IRegisters, Status, tryAsBigGas, tryAsGas } from "@typeberry/pvm-interface";
import { type OutOfBounds, PageFault } from "@typeberry/pvm-interpreter/memory/errors.js";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/memory-index.js";
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
    const result = this.instance.getGasLeft() - (g as bigint);
    if (result >= 0n) {
      this.instance.setGasLeft(result);
      return false;
    }
    this.instance.setGasLeft(0n);
    return true;
  }
}

export class AnanasInterpreter {
  private initialGas = 0n;
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
    this.initialGas = gas as bigint;
    this.instance.resetJAM(programArr, pc, this.initialGas, argsArr, true);
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
    if (param === 0) {
      return null;
    }
    return tryAsU32(param);
  }

  getGasCounter(): GasCounter {
    return this.gas;
  }

  getGasConsumed(): Gas {
    const gasConsumed = this.initialGas - (this.gas.get() as bigint);

    if (gasConsumed < 0) {
      return tryAsBigGas(this.initialGas);
    }

    return tryAsBigGas(gasConsumed);
  }

  getRegisters(): IRegisters {
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
