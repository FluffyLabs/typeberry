import type { Interpreter, Memory } from "@typeberry/pvm-interpreter";
import { type Gas, tryAsBigGas } from "@typeberry/pvm-interpreter/gas";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import { Status } from "@typeberry/pvm-interpreter/status";
import { check } from "@typeberry/utils";
import { PvmExecution, tryAsHostCallIndex } from "./host-call-handler";
import { HostCallMemory } from "./host-call-memory";
import { HostCallRegisters } from "./host-call-registers";
import type { HostCallsManager } from "./host-calls-manager";
import type { InterpreterInstanceManager } from "./interpreter-instance-manager";

class ReturnValue {
  private constructor(
    public consumedGas: Gas,
    public statusOrMemorySlice: Status | Uint8Array,
  ) {}

  static fromOOG(consumedGas: Gas) {
    return new ReturnValue(consumedGas, Status.OOG);
  }

  static fromPanic(consumedGas: Gas) {
    return new ReturnValue(consumedGas, Status.PANIC);
  }

  static fromMemoryFault(consumedGas: Gas) {
    return new ReturnValue(consumedGas, new Uint8Array(0));
  }

  static fromMemorySlice(consumedGas: Gas, memorySlice: Uint8Array) {
    return new ReturnValue(consumedGas, memorySlice);
  }

  hasMemorySlice(): this is this & { statusOrMemorySlice: Uint8Array } {
    return this.statusOrMemorySlice instanceof Uint8Array;
  }

  hasStatus(): this is this & { statusOrMemorySlice: Status } {
    return !this.hasMemorySlice();
  }
}
export class HostCalls {
  constructor(
    private pvmInstanceManager: InterpreterInstanceManager,
    private hostCalls: HostCallsManager,
  ) {}

  private calculateConsumedGas(initialGas: Gas, gas: Gas): Gas {
    const gasConsumed = tryAsBigGas(initialGas) - tryAsBigGas(gas);

    if (gasConsumed < 0) {
      return initialGas;
    }

    return tryAsBigGas(gasConsumed);
  }

  private getReturnValue(status: Status, pvmInstance: Interpreter): ReturnValue {
    const gasConsumed = pvmInstance.getGasConsumed();
    if (status === Status.OOG) {
      return ReturnValue.fromOOG(gasConsumed);
    }

    if (status === Status.HALT) {
      const memory = pvmInstance.getMemory();
      const regs = pvmInstance.getRegisters();
      const maybeAddress = regs.getLowerU32(10);
      const maybeLength = regs.getLowerU32(11);

      const result = new Uint8Array(maybeLength);
      const startAddress = tryAsMemoryIndex(maybeAddress);
      const pageFault = memory.loadInto(result, startAddress);

      if (pageFault !== null) {
        return ReturnValue.fromMemoryFault(gasConsumed);
      }

      return ReturnValue.fromMemorySlice(gasConsumed, result);
    }

    return ReturnValue.fromPanic(gasConsumed);
  }

  private async execute(pvmInstance: Interpreter) {
    pvmInstance.runProgram();
    for (;;) {
      let status = pvmInstance.getStatus();
      if (status !== Status.HOST) {
        return this.getReturnValue(status, pvmInstance);
      }
      check(
        pvmInstance.getExitParam() !== null,
        "We know that the exit param is not null, because the status is `Status.HOST`",
      );
      const hostCallIndex = pvmInstance.getExitParam() ?? -1;
      const gas = pvmInstance.getGasCounter();
      const regs = new HostCallRegisters(pvmInstance.getRegisters());
      const memory = new HostCallMemory(pvmInstance.getMemory());
      const hostCall = this.hostCalls.get(tryAsHostCallIndex(hostCallIndex));
      const gasCost = typeof hostCall.gasCost === "number" ? hostCall.gasCost : hostCall.gasCost(regs);
      const underflow = gas.sub(gasCost);
      if (underflow) {
        return ReturnValue.fromOOG(pvmInstance.getGasConsumed());
      }
      const result = await hostCall.execute(gas, regs, memory);

      if (result === PvmExecution.Halt) {
        status = Status.HALT;
        return this.getReturnValue(status, pvmInstance);
      }

      pvmInstance.runProgram();
      status = pvmInstance.getStatus();
    }
  }

  async runProgram(
    rawProgram: Uint8Array,
    initialPc: number,
    initialGas: Gas,
    maybeRegisters?: Registers,
    maybeMemory?: Memory,
  ): Promise<ReturnValue> {
    const pvmInstance = await this.pvmInstanceManager.getInstance();
    pvmInstance.reset(rawProgram, initialPc, initialGas, maybeRegisters, maybeMemory);
    try {
      return await this.execute(pvmInstance);
    } finally {
      this.pvmInstanceManager.releaseInstance(pvmInstance);
    }
  }
}
