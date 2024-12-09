import type { Interpreter, Memory } from "@typeberry/pvm-interpreter";
import type { Gas } from "@typeberry/pvm-interpreter/gas";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import { Status } from "@typeberry/pvm-interpreter/status";
import { check } from "@typeberry/utils";
import { type HostCallIndex, PvmExecution } from "./host-call-handler";
import type { HostCallsManager } from "./host-calls-manager";
import type { InterpreterInstanceManager } from "./interpreter-instance-manager";

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
      const maybeAddress = regs.getU32(10);
      const maybeLength = regs.getU32(11);

      const result = new Uint8Array(maybeLength);
      const startAddress = tryAsMemoryIndex(maybeAddress);
      const pageFault = memory.loadInto(result, startAddress);
      // https://graypaper-reader.netlify.app/#/293bf5a/296c02296c02
      return pageFault !== null ? new Uint8Array(0) : result;
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
      const regs = pvmInstance.getRegisters();
      const memory = pvmInstance.getMemory();
      const hostCall = this.hostCalls.get(hostCallIndex as HostCallIndex);
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
