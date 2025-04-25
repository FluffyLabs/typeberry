import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import {
  type HostCallMemory,
  type HostCallRegisters,
  PvmExecution,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { assertNever } from "@typeberry/utils";
import { HostCallResult } from "../results";
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

  async execute(_gas: GasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<PvmExecution | undefined> {
    // `o`
    const hashStart = regs.get(IN_OUT_REG);
    // `z`
    const length = regs.get(8);

    const hash = Bytes.zero(HASH_SIZE);
    const memoryReadResult = memory.loadInto(hash.raw, hashStart);
    if (memoryReadResult.isError) {
      return PvmExecution.Panic;
    }

    const result = this.partialState.requestPreimage(hash, length);
    if (result.isOk) {
      regs.set(IN_OUT_REG, HostCallResult.OK);
      return;
    }

    const e = result.error;
    if (e === RequestPreimageError.AlreadyAvailable || e === RequestPreimageError.AlreadyRequested) {
      regs.set(IN_OUT_REG, HostCallResult.HUH);
      return;
    }

    if (e === RequestPreimageError.InsufficientFunds) {
      regs.set(IN_OUT_REG, HostCallResult.FULL);
      return;
    }

    assertNever(e);
  }
}
