import { Logger } from "@typeberry/logger";
import type { Memory, Pvm } from "@typeberry/pvm-interpreter";
import { createMemoryIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { getPageNumber, getStartPageIndexFromPageNumber } from "@typeberry/pvm-interpreter/memory/memory-utils";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import { Status } from "@typeberry/pvm-interpreter/status";
import { PAGE_SIZE } from "@typeberry/pvm-spi-decoder/memory-conts";
import { check } from "@typeberry/utils";
import type { HostCallsManager } from "./host-calls-manager";
import type { InterpreterInstanceManager } from "./interpreter-instance-manager";

const logger = Logger.new(__filename, "pvm-host-call-extension");

export class HostCalls {
  constructor(
    private pvmInstanceManager: InterpreterInstanceManager,
    private hostCalls: HostCallsManager,
  ) {}

  private getReturnValue(status: Status, memory: Memory, regs: Registers) {
    if (status === Status.OOG) {
      return Status.OOG;
    }

    if (status === Status.HALT) {
      const maybeAddress = regs.asUnsigned[10];
      const maybeLength = regs.asUnsigned[11];
      if (maybeAddress >= 0 && maybeLength > 0 && maybeAddress + maybeLength < 2 ** 32) {
        return [];
      }
      const length = maybeLength;
      const startAddress = createMemoryIndex(maybeAddress);
      const endAddress = createMemoryIndex(maybeAddress + length);
      const firstPage = getPageNumber(startAddress);
      const lastPage = getPageNumber(endAddress);

      const result = new Uint8Array(length);
      for (let i = firstPage; i <= lastPage; i++) {
        const pageDump = memory.getPageDump(i);
        if (!pageDump) {
          return [];
        }

        const resultStartIdx = (i - firstPage) * PAGE_SIZE;
        if (i === firstPage) {
          const startPageIndex = getStartPageIndexFromPageNumber(i);
          const startIndex = startAddress - startPageIndex;
          result.set(pageDump.subarray(startIndex), resultStartIdx);
        } else if (i === lastPage) {
          const startPageIndex = getStartPageIndexFromPageNumber(i);
          const endIndex = endAddress - startPageIndex;
          result.set(pageDump.subarray(0, endIndex), resultStartIdx);
        } else {
          result.set(pageDump, resultStartIdx);
        }
      }

      return result;
    }

    return Status.PANIC;
  }

  private async execute(pvmInstance: Pvm) {
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
      const nextPc = pvmInstance.getNextPC();
      const gas = pvmInstance.getGas();
      const regs = pvmInstance.getRegisters();
      const memory = pvmInstance.getMemory();
      const hostCall = this.hostCalls.get(hostCallIndex);
      if (!hostCall) {
        logger.warn(`host call ${hostCallIndex} is not implemented!`);
        return Status.PANIC;
      }
      await hostCall.execute(gas, regs, memory);

      pvmInstance.resume(nextPc, gas);
      status = pvmInstance.getStatus();
    }
  }

  async runProgram(
    rawProgram: Uint8Array,
    initialPc: number,
    initialGas: number,
    maybeRegisters?: Registers,
    maybeMemory?: Memory,
  ) {
    const pvmInstance = await this.pvmInstanceManager.getInstance();
    pvmInstance.reset(rawProgram, initialPc, initialGas, maybeRegisters, maybeMemory);
    try {
      return await this.execute(pvmInstance);
    } catch {
    } finally {
      this.pvmInstanceManager.releaseInstance(pvmInstance);
    }
  }
}
