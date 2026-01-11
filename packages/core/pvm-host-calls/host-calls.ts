import { Level, Logger } from "@typeberry/logger";
import { type Gas, type IPvmInterpreter, Status } from "@typeberry/pvm-interface";
import { assertNever, check, safeAllocUint8Array } from "@typeberry/utils";
import { PvmExecution, tryAsHostCallIndex } from "./host-call-handler.js";
import { HostCallMemory } from "./host-call-memory.js";
import { HostCallRegisters } from "./host-call-registers.js";
import type { HostCallsManager } from "./host-calls-manager.js";
import type { InterpreterInstanceManager } from "./interpreter-instance-manager.js";
import { extractRegisters, IoTraceLogger } from "./io-trace-logger.js";
import { TrackedHostCallMemory } from "./tracked-host-call-memory.js";
import { TrackedHostCallRegisters } from "./tracked-host-call-registers.js";

const SPI_ARGS_SEGMENT = 0xfe_ff_00_00;

const ecalliLogger = Logger.new(import.meta.filename, "ecalli");

function createIoTracer(): IoTraceLogger | null {
  if (ecalliLogger.getLevel() > Level.TRACE) {
    return null;
  }
  return new IoTraceLogger((line) => {
    ecalliLogger.trace`${line}`;
  });
}

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

  private getReturnValue(
    status: Status,
    pvmInstance: IPvmInterpreter,
    ioTracer: IoTraceLogger | null,
    panicArg?: number,
  ): ReturnValue {
    const gasConsumed = pvmInstance.gas.used();
    const pc = pvmInstance.getPC();
    const gas = pvmInstance.gas.get();

    if (ioTracer !== null) {
      const regMap = extractRegisters((i) => {
        const regs = new HostCallRegisters(pvmInstance.registers.getAllEncoded());
        return regs.get(i);
      });

      if (status === Status.OOG) {
        ioTracer.logOog(pc, gas, regMap);
      } else if (status === Status.HALT) {
        ioTracer.logHalt(pc, gas, regMap);
      } else {
        ioTracer.logPanic(panicArg ?? 0, pc, gas, regMap);
      }
    }

    if (status === Status.OOG) {
      return ReturnValue.fromStatus(gasConsumed, status);
    }

    if (status === Status.HALT) {
      const regs = new HostCallRegisters(pvmInstance.registers.getAllEncoded());
      const memory = new HostCallMemory(pvmInstance.memory);
      const address = regs.get(7);
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

  private async execute(pvmInstance: IPvmInterpreter, ioTracer: IoTraceLogger | null) {
    pvmInstance.runProgram();
    for (;;) {
      let status = pvmInstance.getStatus();
      if (status !== Status.HOST) {
        return this.getReturnValue(status, pvmInstance, ioTracer);
      }
      check`
        ${pvmInstance.getExitParam() !== null}
        "We know that the exit param is not null, because the status is 'Status.HOST'
      `;
      const hostCallIndex = pvmInstance.getExitParam() ?? -1;
      const gas = pvmInstance.gas;
      const index = tryAsHostCallIndex(hostCallIndex);
      const pc = pvmInstance.getPC();
      const gasBefore = gas.get();

      const hostCall = this.hostCalls.get(index);
      const basicGasCost =
        typeof hostCall.basicGasCost === "number"
          ? hostCall.basicGasCost
          : hostCall.basicGasCost(new HostCallRegisters(pvmInstance.registers.getAllEncoded()));
      const underflow = gas.sub(basicGasCost);

      const pcLog = `[PC: ${pc}]`;

      if (ioTracer !== null) {
        const trackedRegs = new TrackedHostCallRegisters(pvmInstance.registers.getAllEncoded());
        const trackedMemory = new TrackedHostCallMemory(pvmInstance.memory);

        const regMapBefore = extractRegisters((i) => trackedRegs.get(i));
        ioTracer.logEcalli(index, pc, gasBefore, regMapBefore);

        if (underflow) {
          this.hostCalls.traceHostCall(`${pcLog} OOG`, index, hostCall, trackedRegs, gas.get());
          ioTracer.logSetGas(gas.get());
          return this.getReturnValue(Status.OOG, pvmInstance, ioTracer);
        }

        this.hostCalls.traceHostCall(`${pcLog} Invoking`, index, hostCall, trackedRegs, gasBefore);
        const result = await hostCall.execute(gas, trackedRegs, trackedMemory);

        ioTracer.logHostActions(trackedMemory.getOperations(), trackedRegs.getWriteOperations(), gasBefore, gas.get());

        this.hostCalls.traceHostCall(
          result === undefined ? `${pcLog} Result` : `${pcLog} Status(${PvmExecution[result]})`,
          index,
          hostCall,
          trackedRegs,
          gas.get(),
        );
        pvmInstance.registers.setAllEncoded(trackedRegs.getEncoded());

        if (result === PvmExecution.Halt) {
          return this.getReturnValue(Status.HALT, pvmInstance, ioTracer);
        }
        if (result === PvmExecution.Panic) {
          return this.getReturnValue(Status.PANIC, pvmInstance, ioTracer, 1);
        }
        if (result === PvmExecution.OOG) {
          return this.getReturnValue(Status.OOG, pvmInstance, ioTracer);
        }
        if (result === undefined) {
          pvmInstance.runProgram();
          continue;
        }
        assertNever(result);
      }

      const regs = new HostCallRegisters(pvmInstance.registers.getAllEncoded());
      const memory = new HostCallMemory(pvmInstance.memory);

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
        return this.getReturnValue(status, pvmInstance, ioTracer);
      }

      if (result === PvmExecution.Panic) {
        status = Status.PANIC;
        return this.getReturnValue(status, pvmInstance, ioTracer);
      }

      if (result === PvmExecution.OOG) {
        status = Status.OOG;
        return this.getReturnValue(status, pvmInstance, ioTracer);
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
    const ioTracer = createIoTracer();

    if (ioTracer !== null) {
      ioTracer.logProgram(program);
      if (args.length > 0) {
        ioTracer.logInitialMemWrite(SPI_ARGS_SEGMENT, args);
      }
    }

    const pvmInstance = await this.pvmInstanceManager.getInstance();
    pvmInstance.resetJam(program, args, initialPc, initialGas);

    if (ioTracer !== null) {
      const initialRegs = extractRegisters((i) => {
        const regs = new HostCallRegisters(pvmInstance.registers.getAllEncoded());
        return regs.get(i);
      });
      ioTracer.logStart(pvmInstance.getPC(), pvmInstance.gas.get(), initialRegs);
    }

    try {
      return await this.execute(pvmInstance, ioTracer);
    } finally {
      this.pvmInstanceManager.releaseInstance(pvmInstance);
    }
  }
}
