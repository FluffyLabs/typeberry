import { Interpreter } from "@fluffylabs/pvm-interpreter-lite";
import { tryAsU32, type U32 } from "@typeberry/numbers";
import {
  type Gas,
  getPageStartAddress,
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

export class LiteInterpreter implements IPvmInterpreter {
  readonly registers: IRegisters;
  readonly memory: IMemory;
  readonly gas: IGasCounter;

  private readonly inner: Interpreter;

  constructor() {
    this.inner = new Interpreter();

    const regs = this.inner.registers;
    this.registers = {
      getAllEncoded(): Uint8Array {
        return regs.getAllEncoded();
      },
      setAllEncoded(bytes: Uint8Array): void {
        regs.setAllEncoded(bytes);
      },
    };

    // Memory: thin adapter for return type (number → Result)
    const mem = this.inner.memory;
    this.memory = {
      store(address: U32, bytes: Uint8Array): Result<OK, PageFault> {
        if (mem.fastStore(address, bytes) === 0) {
          return Result.ok(OK);
        }
        return Result.error({ address: getPageStartAddress(address) }, () => "Memory is unwritable!");
      },
      read(address: U32, result: Uint8Array): Result<OK, PageFault> {
        if (result.length === 0) {
          return Result.ok(OK);
        }
        if (mem.fastLoad(result, address) === 0) {
          return Result.ok(OK);
        }
        return Result.error({ address: getPageStartAddress(address) }, () => "Memory is inaccessible!");
      },
    };

    // Gas: wrap to convert between Gas types
    const innerRef = this.inner;
    this.gas = {
      initialGas: tryAsGas(0n),
      get(): Gas {
        return tryAsGas(innerRef.gas.get());
      },
      set(g: Gas): void {
        innerRef.gas.set(BigInt(g));
      },
      sub(g: Gas): boolean {
        return innerRef.gas.sub(BigInt(g));
      },
      used(): Gas {
        const gasConsumed = BigInt(this.initialGas) - BigInt(innerRef.gas.get());
        if (gasConsumed < 0) {
          return this.initialGas;
        }
        return tryAsBigGas(gasConsumed);
      },
    };
  }

  resetJam(program: Uint8Array, args: Uint8Array, pc: number, gas: Gas): void {
    this.gas.initialGas = gas;
    this.inner.resetJam(program, args, pc, BigInt(gas));
  }

  runProgram(): void {
    this.inner.runProgram();
  }

  getStatus(): Status {
    const status = this.inner.getStatus();
    switch (status) {
      case 255:
        return Status.OK;
      case 0:
        return Status.HALT;
      case 1:
        return Status.PANIC;
      case 2:
        return Status.FAULT;
      case 3:
        return Status.HOST;
      case 4:
        return Status.OOG;
      default:
        return Status.PANIC;
    }
  }

  getPC(): number {
    return this.inner.getPC();
  }

  getExitParam(): U32 | null {
    const param = this.inner.getExitParam();
    return param === null ? null : tryAsU32(param);
  }
}
