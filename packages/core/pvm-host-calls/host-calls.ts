import type { Interpreter, Memory } from "@typeberry/pvm-interpreter";
import type { Gas } from "@typeberry/pvm-interpreter/gas.js";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/memory-index.js";
import type { Registers } from "@typeberry/pvm-interpreter/registers.js";
import { Status } from "@typeberry/pvm-interpreter/status.js";
import { check } from "@typeberry/utils";
import { PvmExecution, tryAsHostCallIndex } from "./host-call-handler.js";
import { HostCallMemory } from "./host-call-memory.js";
import { HostCallRegisters } from "./host-call-registers.js";
import type { HostCallsManager } from "./host-calls-manager.js";
import type { InterpreterInstanceManager } from "./interpreter-instance-manager.js";

class ReturnValue {
  private constructor(
    public consumedGas: Gas,
    public status: Status | null,
    public memorySlice: Uint8Array | null,
  ) {
    check(
      (status === null && memorySlice !== null) || (status !== null && memorySlice === null),
      "`status` and `memorySlice` must not both be null or both be non-null — exactly one must be provided",
    );
  }

  static fromStatus(consumedGas: Gas, status: Status) {
    return new ReturnValue(consumedGas, status, null);
  }

  static fromMemorySlice(consumedGas: Gas, memorySlice: Uint8Array) {
    return new ReturnValue(consumedGas, null, memorySlice);
  }

  hasMemorySlice(): this is this & { status: null; memorySlice: Uint8Array } {
    return this.memorySlice instanceof Uint8Array && this.status === null;
  }

  hasStatus(): this is this & { status: Status; memorySlice: null } {
    return !this.hasMemorySlice();
  }
}
export class HostCalls {
  constructor(
    private pvmInstanceManager: InterpreterInstanceManager,
    private hostCalls: HostCallsManager,
  ) {}

  private getReturnValue(status: Status, pvmInstance: Interpreter): ReturnValue {
    const gasConsumed = pvmInstance.getGasConsumed();
    if (status === Status.OOG) {
      return ReturnValue.fromStatus(gasConsumed, status);
    }

    if (status === Status.HALT) {
      const memory = pvmInstance.getMemory();
      const regs = pvmInstance.getRegisters();
      const maybeAddress = regs.getLowerU32(7);
      const maybeLength = regs.getLowerU32(8);

      const result = new Uint8Array(maybeLength);
      const startAddress = tryAsMemoryIndex(maybeAddress);
      const loadResult = memory.loadInto(result, startAddress);

      if (loadResult.isError) {
        return ReturnValue.fromMemorySlice(gasConsumed, new Uint8Array());
      }

      return ReturnValue.fromMemorySlice(gasConsumed, result);
    }

    return ReturnValue.fromStatus(gasConsumed, Status.PANIC);
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
      const index = tryAsHostCallIndex(hostCallIndex);

      const hostCall = this.hostCalls.get(index);
      const gasBefore = gas.get();
      const gasCost = typeof hostCall.gasCost === "number" ? hostCall.gasCost : hostCall.gasCost(regs);
      const underflow = gas.sub(gasCost);

      if (underflow) {
        this.hostCalls.traceHostCall("OOG", index, hostCall, regs, gas.get());
        return ReturnValue.fromStatus(pvmInstance.getGasConsumed(), Status.OOG);
      }
      this.hostCalls.traceHostCall("Invoking", index, hostCall, regs, gasBefore);
      const result = await hostCall.execute(gas, regs, memory);
      this.hostCalls.traceHostCall(
        result === undefined ? "Result" : `Status(${result})`,
        index,
        hostCall,
        regs,
        gas.get(),
      );

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
