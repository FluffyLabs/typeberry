import type { Interpreter } from "@typeberry/pvm-interpreter";
import type { Gas } from "@typeberry/pvm-interpreter/gas.js";
import { Status } from "@typeberry/pvm-interpreter/status.js";
import type { AnanasInterpreter } from "@typeberry/pvm-interpreter-ananas";
import { assertNever, check, safeAllocUint8Array } from "@typeberry/utils";
import { PvmExecution, tryAsHostCallIndex } from "./host-call-handler.js";
import type { HostCallsManager } from "./host-calls-manager.js";
import type { InterpreterInstanceManager } from "./interpreter-instance-manager.js";

class ReturnValue {
  private constructor(
    public consumedGas: Gas,
    public status: Status | null,
    public memorySlice: Uint8Array | null,
  ) {
    check`
      ${(status === null && memorySlice !== null) || (status !== null && memorySlice === null)}
      'status' and 'memorySlice' must not both be null or both be non-null — exactly one must be provided
    `;
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

  private getReturnValue(status: Status, pvmInstance: Interpreter | AnanasInterpreter): ReturnValue {
    const gasConsumed = pvmInstance.getGasConsumed();
    if (status === Status.OOG) {
      return ReturnValue.fromStatus(gasConsumed, status);
    }

    if (status === Status.HALT) {
      const regs = pvmInstance.getRegisters();
      const memory = pvmInstance.getMemory();
      const address = regs.get(7);
      const length = regs.get(8);
      // NOTE IDK if it's safe, it's dirty quick code
      const result = safeAllocUint8Array(Number(length));
      const loadResult = memory.loadInto(result, address);

      if (loadResult.isError) {
        return ReturnValue.fromMemorySlice(gasConsumed, new Uint8Array());
      }

      return ReturnValue.fromMemorySlice(gasConsumed, result);
    }

    return ReturnValue.fromStatus(gasConsumed, Status.PANIC);
  }

  private async execute(pvmInstance: Interpreter | AnanasInterpreter) {
    pvmInstance.runProgram();
    for (;;) {
      let status = pvmInstance.getStatus();
      if (status !== Status.HOST) {
        return this.getReturnValue(status, pvmInstance);
      }
      check`
        ${pvmInstance.getExitParam() !== null}
        "We know that the exit param is not null, because the status is 'Status.HOST'
      `;
      const hostCallIndex = pvmInstance.getExitParam() ?? -1;
      const regs = pvmInstance.getRegisters();
      const memory = pvmInstance.getMemory();
      const index = tryAsHostCallIndex(hostCallIndex);

      const hostCall = this.hostCalls.get(index);
      const gasCounter = pvmInstance.getGasCounter();
      const gasBefore = gasCounter.get();
      // NOTE: `basicGasCost(regs)` function is for compatibility reasons: pre GP 0.7.2
      const basicGasCost =
        typeof hostCall.basicGasCost === "number" ? hostCall.basicGasCost : hostCall.basicGasCost(regs);
      const underflow = gasCounter.sub(basicGasCost);

      const pcLog = `[PC: ${pvmInstance.getPC()}]`;
      if (underflow) {
        this.hostCalls.traceHostCall(`${pcLog} OOG`, index, hostCall, regs, gasCounter.get());
        return ReturnValue.fromStatus(pvmInstance.getGasConsumed(), Status.OOG);
      }
      this.hostCalls.traceHostCall(`${pcLog} Invoking`, index, hostCall, regs, gasBefore);
      const result = await hostCall.execute(gasCounter, regs, memory);
      this.hostCalls.traceHostCall(
        result === undefined ? `${pcLog} Result` : `${pcLog} Status(${PvmExecution[result]})`,
        index,
        hostCall,
        regs,
        gasCounter.get(),
      );

      if (result === PvmExecution.Halt) {
        status = Status.HALT;
        return this.getReturnValue(status, pvmInstance);
      }

      if (result === PvmExecution.Panic) {
        status = Status.PANIC;
        return this.getReturnValue(status, pvmInstance);
      }

      if (result === PvmExecution.OOG) {
        status = Status.OOG;
        return this.getReturnValue(status, pvmInstance);
      }

      if (result === undefined) {
        pvmInstance.runProgram();
        status = pvmInstance.getStatus();
        continue;
      }

      assertNever(result);
    }
  }

  async runProgram(program: Uint8Array, args: Uint8Array, initialPc: number, initialGas: Gas): Promise<ReturnValue> {
    const pvmInstance = await this.pvmInstanceManager.getInstance();
    //console.log`${pvmInstance.printProgram(program)}`;
    pvmInstance.resetJam(program, args, initialPc, initialGas);
    try {
      return await this.execute(pvmInstance);
    } finally {
      this.pvmInstanceManager.releaseInstance(pvmInstance);
    }
  }
}
