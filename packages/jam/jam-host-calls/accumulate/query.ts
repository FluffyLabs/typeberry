import type { ServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU64 } from "@typeberry/numbers";
import {
  type HostCallHandler,
  type HostCallMemory,
  type HostCallRegisters,
  PvmExecution,
  traceRegisters,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type IGasCounter, tryAsSmallGas } from "@typeberry/pvm-interface";
import { type PartialState, PreimageStatusKind } from "../externalities/partial-state.js";
import { logger } from "../logger.js";
import { HostCallResult } from "../results.js";

const IN_OUT_REG_1 = 7;
const IN_OUT_REG_2 = 8;
const UPPER_BITS_SHIFT = 32n;

/**
 * Query the state of the preimage.
 *
 * Get time slots for current preimage availability status.
 *
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/37cb0237cb02?v=0.7.2
 */
export class Query implements HostCallHandler {
  index = tryAsHostCallIndex(22);
  basicGasCost = tryAsSmallGas(10);
  tracedRegisters = traceRegisters(IN_OUT_REG_1, IN_OUT_REG_2);

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly partialState: PartialState,
  ) {}

  async execute(_gas: IGasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<PvmExecution | undefined> {
    // `o`
    const hashStart = regs.get(IN_OUT_REG_1);
    // `z`
    const length = regs.get(IN_OUT_REG_2);

    const hash = Bytes.zero(HASH_SIZE);
    const memoryReadResult = memory.loadInto(hash.raw, hashStart);
    // error while reading the memory.
    if (memoryReadResult.isError) {
      logger.trace`QUERY(${hash}, ${length}) <- PANIC`;
      return PvmExecution.Panic;
    }

    const result = this.partialState.checkPreimageStatus(hash.asOpaque(), length);
    const zero = tryAsU64(0n);

    if (result === null) {
      logger.trace`QUERY(${hash}, ${length}) <- NONE`;
      regs.set(IN_OUT_REG_1, HostCallResult.NONE);
      regs.set(IN_OUT_REG_2, zero);
      return;
    }

    switch (result.status) {
      case PreimageStatusKind.Requested:
        logger.trace`QUERY(${hash}, ${length}) <- REQUESTED`;
        regs.set(IN_OUT_REG_1, zero);
        regs.set(IN_OUT_REG_2, zero);
        return;
      case PreimageStatusKind.Available:
        logger.trace`QUERY(${hash}, ${length}) <- AVAILABLE ${result.data}`;
        regs.set(IN_OUT_REG_1, tryAsU64((BigInt(result.data[0]) << UPPER_BITS_SHIFT) + 1n));
        regs.set(IN_OUT_REG_2, zero);
        return;
      case PreimageStatusKind.Unavailable:
        regs.set(IN_OUT_REG_1, tryAsU64((BigInt(result.data[0]) << UPPER_BITS_SHIFT) + 2n));
        regs.set(IN_OUT_REG_2, tryAsU64(result.data[1]));
        return;
      case PreimageStatusKind.Reavailable:
        logger.trace`QUERY(${hash}, ${length}) <- REAVAILABLE ${result.data}`;
        regs.set(IN_OUT_REG_1, tryAsU64((BigInt(result.data[0]) << UPPER_BITS_SHIFT) + 3n));
        regs.set(IN_OUT_REG_2, tryAsU64((BigInt(result.data[2]) << UPPER_BITS_SHIFT) + BigInt(result.data[1])));
        return;
    }
  }
}
