import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import {
  type Memory,
  type PvmExecution,
  type Registers,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { assertNever } from "@typeberry/utils";
import { LegacyHostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import { type AccumulationPartialState, RequestPreimageError } from "./partial-state";

const IN_OUT_REG = 7;

/**
 * Request a preimage to be available.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/33fd0033fd00
 */
export class Solicit implements HostCallHandler {
  index = tryAsHostCallIndex(13);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<PvmExecution | undefined> {
    // `o`
    const hashStart = tryAsMemoryIndex(regs.getU32(IN_OUT_REG));
    // `z`
    const length = tryAsU32(regs.getU32(8));

    const hash = Bytes.zero(HASH_SIZE);
    const pageFault = memory.loadInto(hash.raw, hashStart);
    if (pageFault !== null) {
      regs.setU32(IN_OUT_REG, LegacyHostCallResult.OOB);
      return;
    }

    const result = this.partialState.requestPreimage(hash, length);
    if (result.isOk) {
      regs.setU32(IN_OUT_REG, LegacyHostCallResult.OK);
      return;
    }

    const e = result.error;
    if (e === RequestPreimageError.AlreadyAvailable || e === RequestPreimageError.AlreadyRequested) {
      regs.setU32(IN_OUT_REG, LegacyHostCallResult.HUH);
      return;
    }

    if (e === RequestPreimageError.InsufficientFunds) {
      regs.setU32(IN_OUT_REG, LegacyHostCallResult.FULL);
      return;
    }

    assertNever(e);
  }
}
