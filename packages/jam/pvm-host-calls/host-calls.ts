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

export class HostCalls {
  constructor(
    private pvmInstanceManager: InterpreterInstanceManager,
    private hostCalls: HostCallsManager,
  ) {}

  private getReturnValue(status: Status, memory: Memory, regs: Registers): Status | Uint8Array {
    if (status === Status.OOG) {
      return Status.OOG;
    }

    if (status === Status.HALT) {
      const maybeAddress = regs.getLowerU32(10);
      const maybeLength = regs.getLowerU32(11);

      const result = new Uint8Array(maybeLength);
      const startAddress = tryAsMemoryIndex(maybeAddress);
      const readResult = memory.loadInto(result, startAddress);
      // https://graypaper-reader.netlify.app/#/293bf5a/296c02296c02
      return readResult.isError ? new Uint8Array(0) : result;
    }

    return Status.PANIC;
  }

  private async execute(pvmInstance: Interpreter) {
    pvmInstance.runProgram();
    for (;;) {
      let status = pvmInstance.getStatus();
      if (status !== Status.HOST) {
        return this.getReturnValue(status, pvmInstance.getMemory(), pvmInstance.getRegisters());
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
        return Status.OOG;
      }
      const result = await hostCall.execute(gas, regs, memory);

      if (result === PvmExecution.Halt) {
        status = Status.HALT;
        return this.getReturnValue(status, pvmInstance.getMemory(), pvmInstance.getRegisters());
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
  ): Promise<Status | Uint8Array> {
    const pvmInstance = await this.pvmInstanceManager.getInstance();
    pvmInstance.reset(rawProgram, initialPc, initialGas, maybeRegisters, maybeMemory);
    try {
      return await this.execute(pvmInstance);
    } finally {
      this.pvmInstanceManager.releaseInstance(pvmInstance);
    }
  }
}
