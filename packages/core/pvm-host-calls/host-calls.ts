import { type ServiceGas, tryAsServiceGas } from "@typeberry/block";
import { type Gas, type IPvmInterpreter, Status } from "@typeberry/pvm-interface";
import { assertNever, check, safeAllocUint8Array } from "@typeberry/utils";
import { PvmExecution, tryAsHostCallIndex } from "./host-call-handler.js";
import { HostCallMemory } from "./host-call-memory.js";
import { HostCallRegisters } from "./host-call-registers.js";
import type { HostCallsManager } from "./host-calls-manager.js";
import type { InterpreterInstanceManager } from "./interpreter-instance-manager.js";

/**
 * Outer VM return status.
 *
 * This is a limited status returned by outer VM.
 */
export enum ReturnStatus {
  /** Execution succesful. */
  OK = 0,
  /** Execution went out of gas. */
  OOG = 1,
  /** Execution trapped or panicked. */
  PANIC = 2,
}

export type ReturnValue = {
  consumedGas: ServiceGas;
} & (
  | {
      status: ReturnStatus.OK;
      memorySlice: Uint8Array;
    }
  | {
      status: ReturnStatus.OOG | ReturnStatus.PANIC;
    }
);

export class HostCalls {
  constructor(
    private pvmInstanceManager: InterpreterInstanceManager,
    private hostCalls: HostCallsManager,
  ) {}

  private getReturnValue(status: Status, pvmInstance: IPvmInterpreter): ReturnValue {
    const consumedGas = tryAsServiceGas(pvmInstance.gas.used());
    if (status === Status.OOG) {
      return { consumedGas, status: ReturnStatus.OOG };
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
        return { consumedGas, status: ReturnStatus.OK, memorySlice: new Uint8Array() };
      }

      return { consumedGas, status: ReturnStatus.OK, memorySlice: result };
    }

    return { consumedGas, status: ReturnStatus.PANIC };
  }

  private async execute(pvmInstance: IPvmInterpreter): Promise<ReturnValue> {
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
        return { consumedGas: tryAsServiceGas(gas.used()), status: ReturnStatus.OOG };
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
