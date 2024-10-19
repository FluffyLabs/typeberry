import { Logger } from "@typeberry/logger";
import type { Memory, Pvm } from "@typeberry/pvm";
import { createMemoryIndex } from "@typeberry/pvm/memory/memory-index";
import { getPageNumber, getStartPageIndexFromPageNumber } from "@typeberry/pvm/memory/memory-utils";
import type { Registers } from "@typeberry/pvm/registers";
import { Status } from "@typeberry/pvm/status";
import { PAGE_SIZE } from "../pvm-standard-program-decoder/memory-conts";
import type { HostCalls } from "./host-calls";
import type { PvmInstanceManager } from "./pvm-instance-manager";

const logger = Logger.new(__filename, "pvm-host-call-extension");

export class PvmHostCallExtension {
  constructor(
    private pvmInstanceManager: PvmInstanceManager,
    private hostCalls: HostCalls,
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

        if (i === firstPage) {
          const startPageIndex = getStartPageIndexFromPageNumber(i);
          const startIndex = startAddress - startPageIndex;
          result.set(pageDump.subarray(startIndex), (i - firstPage) * PAGE_SIZE);
        } else if (i === lastPage) {
          const startPageIndex = getStartPageIndexFromPageNumber(i);
          const endIndex = endAddress - startPageIndex;
          result.set(pageDump.subarray(0, endIndex), (i - firstPage) * PAGE_SIZE);
        } else {
          result.set(pageDump, (i - firstPage) * PAGE_SIZE);
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
