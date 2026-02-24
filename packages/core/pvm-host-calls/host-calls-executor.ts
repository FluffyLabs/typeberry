import { type Gas, type IPvmInterpreter, Status } from "@typeberry/pvm-interface";
import { assertNever, check, safeAllocUint8Array } from "@typeberry/utils";
import { EcalliTraceLogger } from "./ecalli-trace-logger.js";
import { PvmExecution, tryAsHostCallIndex } from "./host-call-handler.js";
import { HostCallMemory } from "./host-call-memory.js";
import { HostCallRegisters } from "./host-call-registers.js";
import type { HostCalls } from "./host-calls.js";
import type { PvmInstanceManager } from "./pvm-instance-manager.js";

/**
 * Outer VM return status.
 *
 * This is a limited status returned by outer VM.
 *
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/24a10124a101?v=0.7.2
 */
export enum ReturnStatus {
  /** Execution succesful. */
  OK = 0,
  /** Execution went out of gas. */
  OOG = 1,
  /** Execution trapped or panicked. */
  PANIC = 2,
}

export type ReturnValue<TGas = Gas> = {
  consumedGas: TGas;
} & (
  | {
      status: ReturnStatus.OK;
      memorySlice: Uint8Array;
    }
  | {
      status: ReturnStatus.OOG | ReturnStatus.PANIC;
    }
);

export class HostCallsExecutor {
  constructor(
    private pvmInstanceManager: PvmInstanceManager,
    private hostCalls: HostCalls,
    private ioTracer: EcalliTraceLogger | null = EcalliTraceLogger.create(),
  ) {}

  private getReturnValue(
    status: Status,
    pvmInstance: IPvmInterpreter,
    registers: HostCallRegisters,
    memory: HostCallMemory,
  ): ReturnValue {
    const consumedGas = pvmInstance.gas.used();
    const pc = pvmInstance.getPC();
    const gas = pvmInstance.gas.get();

    if (status === Status.OOG) {
      this.ioTracer?.logOog(pc, gas, registers);
      return { consumedGas, status: ReturnStatus.OOG };
    }

    if (status === Status.HALT) {
      this.ioTracer?.logHalt(pc, gas, registers);

      const address = registers.get(7);
      // NOTE we are taking the the lower U32 part of the register, hence it's safe.
      const length = Number(registers.get(8) & 0xffff_ffffn);

      const result = safeAllocUint8Array(length);

      const loadResult = memory.loadInto(result, address);

      if (loadResult.isError) {
        return { consumedGas, status: ReturnStatus.OK, memorySlice: new Uint8Array() };
      }

      return { consumedGas, status: ReturnStatus.OK, memorySlice: result };
    }

    this.ioTracer?.logPanic(pvmInstance.getExitParam() ?? 0, pc, gas, registers);
    return { consumedGas, status: ReturnStatus.PANIC };
  }

  private async execute(pvmInstance: IPvmInterpreter, initialPc: number) {
    const ioTracker = this.ioTracer?.tracker() ?? null;
    const registers = new HostCallRegisters(pvmInstance.registers.getAllEncoded());
    registers.ioTracker = ioTracker;
    const memory = new HostCallMemory(pvmInstance.memory);
    memory.ioTracker = ioTracker;

    const gas = pvmInstance.gas;

    // log start of execution (note the PVM initialisation should be logged already)
    this.ioTracer?.logStart(initialPc, pvmInstance.gas.get(), registers);

    for (;;) {
      // execute program as much as we can
      pvmInstance.runProgram();
      // and update the PVM state
      registers.setEncoded(pvmInstance.registers.getAllEncoded());
      const status = pvmInstance.getStatus();
      const pc = pvmInstance.getPC();
      const exitParam = pvmInstance.getExitParam() ?? -1;

      if (status !== Status.HOST) {
        return this.getReturnValue(status, pvmInstance, registers, memory);
      }

      // get the PVM state now
      check`
        ${exitParam !== -1}
        "We know that the exit param is not null, because the status is 'Status.HOST'
      `;
      const hostCallIndex = tryAsHostCallIndex(exitParam);

      // retrieve the host call
      const hostCall = this.hostCalls.get(hostCallIndex);
      // NOTE: `basicGasCost(regs)` function is for compatibility reasons: pre GP 0.7.2
      const basicGasCost =
        typeof hostCall.basicGasCost === "number" ? hostCall.basicGasCost : hostCall.basicGasCost(registers);

      // calculate gas
      const gasBefore = gas.get();
      const underflow = gas.sub(basicGasCost);

      const pcLog = `[PC: ${pc}]`;
      if (underflow) {
        const gasAfterBasicGas = gas.get();
        this.hostCalls.traceHostCall(`${pcLog} OOG`, hostCallIndex, hostCall, registers, gasAfterBasicGas);
        this.ioTracer?.logSetGas(gasAfterBasicGas);
        return this.getReturnValue(Status.OOG, pvmInstance, registers, memory);
      }

      this.ioTracer?.logEcalli(hostCallIndex, pc, gasBefore, registers);
      this.hostCalls.traceHostCall(`${pcLog} Invoking`, hostCallIndex, hostCall, registers, gasBefore);
      ioTracker?.clear();
      const result = await hostCall.execute(gas, registers, memory);

      const gasAfter = gas.get();
      this.ioTracer?.logHostActions(ioTracker, gasBefore, gasAfter);
      this.hostCalls.traceHostCall(
        result === undefined ? `${pcLog} Result` : `${pcLog} Status(${PvmExecution[result]})`,
        hostCallIndex,
        hostCall,
        registers,
        gasAfter,
      );
      pvmInstance.registers.setAllEncoded(registers.getEncoded());

      if (result === PvmExecution.Halt) {
        return this.getReturnValue(Status.HALT, pvmInstance, registers, memory);
      }
      if (result === PvmExecution.Panic) {
        return this.getReturnValue(Status.PANIC, pvmInstance, registers, memory);
      }
      if (result === PvmExecution.OOG) {
        return this.getReturnValue(Status.OOG, pvmInstance, registers, memory);
      }
      if (result === undefined) {
        continue;
      }
      assertNever(result);
    }
  }

  async runProgram(program: Uint8Array, args: Uint8Array, initialPc: number, initialGas: Gas): Promise<ReturnValue> {
    const pvmInstance = await this.pvmInstanceManager.getInstance();
    pvmInstance.resetJam(program, args, initialPc, initialGas);

    try {
      this.ioTracer?.logProgram(program, args);
      return await this.execute(pvmInstance, initialPc);
    } finally {
      this.pvmInstanceManager.releaseInstance(pvmInstance);
    }
  }
}
