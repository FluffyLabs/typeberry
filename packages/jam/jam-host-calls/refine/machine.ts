import { BytesBlob } from "@typeberry/bytes";
import { tryAsU32 } from "@typeberry/numbers";
import { type HostCallHandler, PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import {
  type GasCounter,
  type Memory,
  type Registers,
  tryAsMemoryIndex,
  tryAsSmallGas,
} from "@typeberry/pvm-interpreter";
import { ProgramDecoder } from "@typeberry/pvm-interpreter/program-decoder/program-decoder";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import type { RefineExternalities } from "./refine-externalities";

const IN_OUT_REG = 7;

/**
 * Initiate a PVM instance with given program code and entrypoint (program counter).
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/349902349902
 */
export class Machine implements HostCallHandler {
  index = tryAsHostCallIndex(20);
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
    if (codePageFault !== null) {
      return PvmExecution.Panic;
    }

    // check if the code is valid
    const program = ProgramDecoder.deblob(code);
    if (program.isError) {
      regs.setU64(IN_OUT_REG, HostCallResult.HUH);
      return;
    }

    // TODO [MaSo] can machineId collide with HOST_CALL_RESULT?
    const machineId = await this.refine.machineInit(BytesBlob.blobFrom(code), entrypoint);
    regs.setU64(IN_OUT_REG, machineId);
  }
}
