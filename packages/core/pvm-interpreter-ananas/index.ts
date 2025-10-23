import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { instantiate } from "@fluffylabs/anan-as/raw";
import { tryAsU32, type U32 } from "@typeberry/numbers";
import {
  type Gas,
  type IGasCounter,
  type IMemory,
  type IPvmInterpreter,
  type IRegisters,
  type PageFault,
  Status,
  tryAsBigGas,
  tryAsGas,
} from "@typeberry/pvm-interface";
import { OK, Result } from "@typeberry/utils";
import type { AnanasAPI } from "./api.js";

// Max u32 value
const INF_STEPS = 2 ** 32 - 1;

class AnanasRegisters implements IRegisters {
  constructor(private readonly instance: AnanasAPI) {}

  getAllEncoded(): Uint8Array {
    return this.instance.getRegisters();
  }

  setAllFromBytes(bytes: Uint8Array): void {
    this.instance.setRegisters(lowerBytes(bytes));
  }

  getAllU64(): BigUint64Array {
    const bytes = this.getAllEncoded();
    return new BigUint64Array(bytes.buffer, bytes.byteOffset);
  }
}

class AnanasMemory implements IMemory {
  constructor(private readonly instance: AnanasAPI) {}

  store(address: U32, bytes: Uint8Array): Result<OK, PageFault> {
    try {
      this.instance.setMemory(address, bytes);
    } catch {
      return Result.error({ address }, () => "Memory is inaccessible!");
    }
    return Result.ok(OK);
  }

  read(address: U32, result: Uint8Array): Result<OK, PageFault> {
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
    const result = this.instance.getGasLeft() - BigInt(g as number | bigint);
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

export class AnanasInterpreter implements IPvmInterpreter {
  readonly registers: AnanasRegisters;
  readonly memory: AnanasMemory;
  readonly gas: AnanasGasCounter;

  private constructor(private readonly instance: AnanasAPI) {
    this.registers = new AnanasRegisters(instance);
    this.memory = new AnanasMemory(instance);
    this.gas = new AnanasGasCounter(instance);
  }

  static async new() {
    const wasmPath = fileURLToPath(new URL("./node_modules/@fluffylabs/anan-as/build/release.wasm", import.meta.url));
    const wasmBuffer = await readFile(wasmPath);
    const wasmModule = await WebAssembly.compile(wasmBuffer);
    const instance = await instantiate(wasmModule, {
      env: {
        abort: () => {
          throw new Error("Abort called from WASM");
        },
      },
    });
    return new AnanasInterpreter(instance);
  }

  resetJam(program: Uint8Array, args: Uint8Array, pc: number, gas: Gas): void {
    const programArr = lowerBytes(program);
    const argsArr = lowerBytes(args);
    this.gas.initialGas = gas;
    this.instance.resetJAM(programArr, pc, gas as bigint, argsArr, true);
  }

  resetGeneric(program: Uint8Array, _pc: number, gas: Gas): void {
    const programArr = lowerBytes(program);
    const emptyRegisters = Array(13 * 8).fill(0);
    const pageMap = new Uint8Array();
    const chunks = new Uint8Array();
    this.gas.initialGas = gas;
    this.instance.resetGenericWithMemory(programArr, emptyRegisters, pageMap, chunks, BigInt(gas), false);
  }

  nextStep(): boolean {
    return this.instance.nextStep();
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
    return tryAsU32(this.instance.getExitArg());
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
