import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU64 } from "@typeberry/numbers";
import {
  type HostCallHandler,
  type IHostCallMemory,
  type IHostCallRegisters,
  PvmExecution,
} from "@typeberry/pvm-host-calls";
import { tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
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
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<PvmExecution | undefined> {
    // `o`
    const hashStart = regs.get(IN_OUT_REG_1);
    // `z`
    const length = regs.get(IN_OUT_REG_2);

    const hash = Bytes.zero(HASH_SIZE);
    const memoryReadResult = memory.loadInto(hash.raw, hashStart);
    // error while reading the memory.
    if (memoryReadResult.isError) {
      return PvmExecution.Panic;
    }

    const result = this.partialState.checkPreimageStatus(hash, length);
    const zero = tryAsU64(0n);

    if (result === null) {
      regs.set(IN_OUT_REG_1, HostCallResult.NONE);
      regs.set(IN_OUT_REG_2, zero);
      return;
    }

    switch (result.status) {
      case PreimageStatus.Requested:
        regs.set(IN_OUT_REG_1, zero);
        regs.set(IN_OUT_REG_2, zero);
        return;
      case PreimageStatus.Available:
        regs.set(IN_OUT_REG_1, tryAsU64((BigInt(result.data[0]) << UPPER_BITS_SHIFT) + 1n));
        regs.set(IN_OUT_REG_2, zero);
        return;
      case PreimageStatus.Unavailable:
        regs.set(IN_OUT_REG_1, tryAsU64((BigInt(result.data[0]) << UPPER_BITS_SHIFT) + 2n));
        regs.set(IN_OUT_REG_2, tryAsU64(result.data[1]));
        return;
      case PreimageStatus.Reavailable:
        regs.set(IN_OUT_REG_1, tryAsU64((BigInt(result.data[0]) << UPPER_BITS_SHIFT) + 3n));
        regs.set(IN_OUT_REG_2, tryAsU64((BigInt(result.data[2]) << UPPER_BITS_SHIFT) + BigInt(result.data[1])));
        return;
    }
  }
}
