import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import { type HostCallHandler, type Memory, PvmExecution, type Registers } from "@typeberry/pvm-host-calls";
import { tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsMemoryIndex, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { LegacyHostCallResult } from "../results";
import { LEGACY_CURRENT_SERVICE_ID } from "../utils";
import { type AccumulationPartialState, PreimageStatus } from "./partial-state";

const IN_OUT_REG_1 = 7;
const IN_OUT_REG_2 = 8;
const UPPER_BITS_SHIFT = 32n;

/**
 * Query the state of the accumulator.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/323002323002
 */
export class Query implements HostCallHandler {
  index = tryAsHostCallIndex(13);
  gasCost = tryAsSmallGas(10);
  currentServiceId = LEGACY_CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<PvmExecution | undefined> {
    // `o`
    const hashStart = tryAsMemoryIndex(regs.getU32(IN_OUT_REG_1));
    // `z`
    const length = tryAsU32(regs.getU32(IN_OUT_REG_2));

    const hash = Bytes.zero(HASH_SIZE);
    const pageFault = memory.loadInto(hash.raw, hashStart);
    if (pageFault !== null) {
      return PvmExecution.Panic;
    }

    const result = this.partialState.checkPreimageStatus(hash, length);
    if (result === null) {
      regs.setU32(IN_OUT_REG_1, LegacyHostCallResult.NONE);
      regs.setU64(IN_OUT_REG_2, 0n);
      return;
    }

    switch (result.status) {
      case PreimageStatus.Requested:
        regs.setU64(IN_OUT_REG_1, 0n);
        regs.setU64(IN_OUT_REG_2, 0n);
        return;
      case PreimageStatus.Available:
        regs.setU64(IN_OUT_REG_1, (BigInt(result.data[0]) << UPPER_BITS_SHIFT) + 1n);
        regs.setU64(IN_OUT_REG_2, 0n);
        return;
      case PreimageStatus.Unavailable:
        regs.setU64(IN_OUT_REG_1, (BigInt(result.data[0]) << UPPER_BITS_SHIFT) + 2n);
        regs.setU64(IN_OUT_REG_2, BigInt(result.data[1]));
        return;
      case PreimageStatus.Reavailable:
        regs.setU64(IN_OUT_REG_1, (BigInt(result.data[0]) << UPPER_BITS_SHIFT) + 3n);
        regs.setU64(IN_OUT_REG_2, (BigInt(result.data[2]) << UPPER_BITS_SHIFT) + BigInt(result.data[1]));
        return;
    }
  }
}
