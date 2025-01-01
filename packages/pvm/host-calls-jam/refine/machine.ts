import { BytesBlob } from "@typeberry/bytes";
import { tryAsU32 } from "@typeberry/numbers";
import { type HostCallHandler, type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import {
  type GasCounter,
  type Memory,
  type Registers,
  tryAsMemoryIndex,
  tryAsSmallGas,
} from "@typeberry/pvm-interpreter";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { RefineExternalities } from "./refine-externalities";

const IN_OUT_REG = 7;

/**
 * Start a nested PVM instance with given program code and entrypoint (program counter).
 *
 * https://graypaper.fluffylabs.dev/#/911af30/33cb0033cb00
 */
export class Machine implements HostCallHandler {
  index = tryAsHostCallIndex(18);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<PvmExecution | undefined> {
    // `p_o`: memory index where there program code starts
    const codeStart = tryAsMemoryIndex(regs.getU32(7));
    // `p_z`: length of the program code
    const codeLength = regs.getU32(8);
    // `i`: starting program counter
    const entrypoint = tryAsU32(regs.getU32(9));

    const code = new Uint8Array(codeLength);
    const codePageFault = memory.loadInto(code, codeStart);
    // we return OOB in case the program code couldn't be read
    if (codePageFault !== null) {
      regs.setU32(IN_OUT_REG, HostCallResult.OOB);
      return;
    }

    const machineId = await this.refine.machineStart(BytesBlob.blobFrom(code), entrypoint);
    regs.setU32(IN_OUT_REG, machineId);
    return;
  }
}
