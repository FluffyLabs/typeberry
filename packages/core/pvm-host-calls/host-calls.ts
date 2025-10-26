import { type Gas, type IPvmInterpreter, Status } from "@typeberry/pvm-interface";
import { assertNever, check, safeAllocUint8Array } from "@typeberry/utils";
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

  private getReturnValue(status: Status, pvmInstance: IPvmInterpreter): ReturnValue {
    const gasConsumed = pvmInstance.gas.used();
    if (status === Status.OOG) {
      return ReturnValue.fromStatus(gasConsumed, status);
    }

    if (status === Status.HALT) {
      const regs = new HostCallRegisters(pvmInstance.registers.getAllEncoded());
      const memory = new HostCallMemory(pvmInstance.memory);
      const address = regs.get(7);
      // NOTE we are taking the the lower U32 part of the register, hence it's safe.
      const length = Number(regs.get(8) & 0xffff_ffffn);

      const result = safeAllocUint8Array(length);

      const loadResult = memory.loadInto(result, address);

      if (loadResult.isError) {
        return ReturnValue.fromMemorySlice(gasConsumed, new Uint8Array());
      }

      return ReturnValue.fromMemorySlice(gasConsumed, result);
    }

    return ReturnValue.fromStatus(gasConsumed, Status.PANIC);
  }

  private async execute(pvmInstance: IPvmInterpreter) {
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
      const gas = pvmInstance.gas;
      const regs = new HostCallRegisters(pvmInstance.registers.getAllEncoded());
      const memory = new HostCallMemory(pvmInstance.memory);
      const index = tryAsHostCallIndex(hostCallIndex);

      const hostCall = this.hostCalls.get(index);
      const gasBefore = gas.get();
      // NOTE: `basicGasCost(regs)` function is for compatibility reasons: pre GP 0.7.2
      const basicGasCost =
        typeof hostCall.basicGasCost === "number" ? hostCall.basicGasCost : hostCall.basicGasCost(regs);
      const underflow = gas.sub(basicGasCost);

      const pcLog = `[PC: ${pvmInstance.getPC()}]`;
      if (underflow) {
        this.hostCalls.traceHostCall(`${pcLog} OOG`, index, hostCall, regs, gas.get());
        return ReturnValue.fromStatus(gas.used(), Status.OOG);
      }
      this.hostCalls.traceHostCall(`${pcLog} Invoking`, index, hostCall, regs, gasBefore);
      const result = await hostCall.execute(gas, regs, memory);
      this.hostCalls.traceHostCall(
        result === undefined ? `${pcLog} Result` : `${pcLog} Status(${PvmExecution[result]})`,
        index,
        hostCall,
        regs,
        gas.get(),
      );
      pvmInstance.registers.setAllEncoded(regs.getEncoded());

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
    pvmInstance.resetJam(program, args, initialPc, initialGas);
    try {
      return await this.execute(pvmInstance);
    } finally {
      this.pvmInstanceManager.releaseInstance(pvmInstance);
    }
  }
}
