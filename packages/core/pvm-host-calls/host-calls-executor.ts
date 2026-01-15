import { type Gas, type IPvmInterpreter, Status } from "@typeberry/pvm-interface";
import { assertNever, check, safeAllocUint8Array } from "@typeberry/utils";
import { EcalliTraceLogger } from "./ecalli-trace-logger.js";
import { PvmExecution, tryAsHostCallIndex } from "./host-call-handler.js";
import { HostCallMemory } from "./host-call-memory.js";
import { HostCallRegisters } from "./host-call-registers.js";
import type { HostCalls } from "./host-calls.js";
import type { PvmInstanceManager } from "./pvm-instance-manager.js";

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
    const gasConsumed = pvmInstance.gas.used();
    const pc = pvmInstance.getPC();
    const gas = pvmInstance.gas.get();

    if (status === Status.OOG) {
      this.ioTracer?.logOog(pc, gas, registers);
      return ReturnValue.fromStatus(gasConsumed, status);
    }

    if (status === Status.HALT) {
      this.ioTracer?.logHalt(pc, gas, registers);

      const address = registers.get(7);
      const length = Number(registers.get(8) & 0xffff_ffffn);

      const result = safeAllocUint8Array(length);

      const loadResult = memory.loadInto(result, address);

      if (loadResult.isError) {
        return ReturnValue.fromMemorySlice(gasConsumed, new Uint8Array());
      }

      return ReturnValue.fromMemorySlice(gasConsumed, result);
    }

    this.ioTracer?.logPanic(pvmInstance.getExitParam() ?? 0, pc, gas, registers);
    return ReturnValue.fromStatus(gasConsumed, Status.PANIC);
  }

  private async execute(pvmInstance: IPvmInterpreter) {
    const ioTracker = this.ioTracer?.tracker() ?? null;
    const registers = new HostCallRegisters(pvmInstance.registers.getAllEncoded());
    registers.ioTracker = ioTracker;
    const memory = new HostCallMemory(pvmInstance.memory);
    memory.ioTracker = ioTracker;

    const gas = pvmInstance.gas;

    // log start of execution (note the PVM initialisation should be logged already)
    this.ioTracer?.logStart(pvmInstance.getPC(), pvmInstance.gas.get(), registers);

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
        pvmInstance.runProgram();
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
      return await this.execute(pvmInstance);
    } finally {
      this.pvmInstanceManager.releaseInstance(pvmInstance);
    }
  }
}
