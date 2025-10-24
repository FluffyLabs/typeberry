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
  NO_OF_REGISTERS,
  type PageFault,
  REGISTER_BYTE_SIZE,
  Status,
  tryAsBigGas,
  tryAsGas,
} from "@typeberry/pvm-interface";
import { check, OK, Result } from "@typeberry/utils";
import type { AnanasAPI } from "./api.js";

const WASM_MODULE = import.meta.resolve("@fluffylabs/anan-as/release-mini.wasm");

// Max u32 value
const INF_STEPS = 2 ** 32 - 1;

class AnanasRegisters implements IRegisters {
  constructor(private readonly instance: AnanasAPI) {}

  getAllEncoded(): Uint8Array {
    return this.instance.getRegisters();
  }

  setAllFromBytes(bytes: Uint8Array): void {
    check`${bytes.length === NO_OF_REGISTERS * REGISTER_BYTE_SIZE} Incorrect size of input registers. Got: ${bytes.length}, need: ${NO_OF_REGISTERS * REGISTER_BYTE_SIZE}`;
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
    // TODO [MaSo] catch returned value (boolean) and produce error or ok
    //
    // if (this.instance.setMemory(address, bytes)) {
    //   return Result.ok(OK);
    // }
    // return Result.error({ address }, () => "Memory is inaccessible!");
    this.instance.setMemory(address, bytes);
    return Result.ok(OK);
  }

  read(address: U32, result: Uint8Array): Result<OK, PageFault> {
    // TODO [MaSo] catch returned value (Uint8Array | null) and produce error or ok
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
    const result = this.instance.getGasLeft() - BigInt(g);
    if (result >= 0n) {
      this.instance.setGasLeft(result);
      return false;
    }
    this.instance.setGasLeft(0n);
    return true;
  }

  used(): Gas {
    const gasConsumed = BigInt(this.initialGas) - BigInt(this.get());

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
    const wasmPath = fileURLToPath(new URL(WASM_MODULE, import.meta.url));
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
    this.instance.resetJAM(programArr, pc, BigInt(gas), argsArr, true);
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
