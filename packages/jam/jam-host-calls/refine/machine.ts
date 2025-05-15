import { BytesBlob } from "@typeberry/bytes";
import {
  type HostCallHandler,
  type IHostCallMemory,
  type IHostCallRegisters,
  PvmExecution,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { type RefineExternalities, tryAsProgramCounter } from "../externalities/refine-externalities";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";

const IN_OUT_REG = 7;

/**
 * Initiate a PVM instance with given program code and entrypoint (program counter).
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/353b00353b00?v=0.6.4
 */
export class Machine implements HostCallHandler {
  index = tryAsHostCallIndex(20);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly refine: RefineExternalities) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<PvmExecution | undefined> {
    // `p_o`: memory index where there program code starts
    const codeStart = regs.get(7);
    // `p_z`: length of the program code
    const codeLength = regs.get(8);
    // `i`: starting program counter
    const entrypoint = tryAsProgramCounter(regs.get(9));

    const codeLengthClamped = codeLength > 2n ** 32n ? 2 ** 32 : Number(codeLength);
    const code = new Uint8Array(codeLengthClamped);
    const codeLoadResult = memory.loadInto(code, codeStart);
    if (codeLoadResult.isError) {
      return PvmExecution.Panic;
    }

    // NOTE: Highly unlikely, but machineId could potentially collide with HOST_CALL_RESULT.
    const machinInitResult = await this.refine.machineInit(BytesBlob.blobFrom(code), entrypoint);
    if (machinInitResult.isError) {
      regs.set(IN_OUT_REG, HostCallResult.HUH);
    } else {
      regs.set(IN_OUT_REG, machinInitResult.ok);
    }
  }
}
