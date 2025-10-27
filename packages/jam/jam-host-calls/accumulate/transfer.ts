import { type ServiceId, tryAsServiceGas } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import type { HostCallHandler, HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type IGasCounter, tryAsGas, tryAsSmallGas } from "@typeberry/pvm-interface";
import { assertNever, Compatibility, GpVersion, resultToString } from "@typeberry/utils";
import { type PartialState, TRANSFER_MEMO_BYTES, TransferError } from "../externalities/partial-state.js";
import { logger } from "../logger.js";
import { HostCallResult } from "../results.js";
import { getServiceId } from "../utils.js";

const IN_OUT_REG = 7; // `d`
const AMOUNT_REG = 8; // `a`
const TRANSFER_GAS_FEE_REG = 9; // `l`
const MEMO_START_REG = 10; // `o`

/**
 * Transfer balance from one service account to another.
 *
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/373f00373f00?v=0.7.2
 */
export class Transfer implements HostCallHandler {
  index = tryAsHostCallIndex(20);
  /**
   * `g = 10 + t`
   *
   * `t` has positive value, only when status of a transfer is `OK`
   * `0` otherwise
   *
   * Pre0.7.2: `g = 10 + ω9`
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/373f00373f00?v=0.7.2
   */
  basicGasCost = Compatibility.isGreaterOrEqual(GpVersion.V0_7_2)
    ? tryAsSmallGas(10)
    : (regs: HostCallRegisters) => tryAsGas(10n + regs.get(TRANSFER_GAS_FEE_REG));

  tracedRegisters = traceRegisters(IN_OUT_REG, AMOUNT_REG, TRANSFER_GAS_FEE_REG, MEMO_START_REG);

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly partialState: PartialState,
  ) {}

  async execute(gas: IGasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<undefined | PvmExecution> {
    // `d`: destination
    const destination = getServiceId(regs.get(IN_OUT_REG));
    // `a`: amount
    const amount = regs.get(AMOUNT_REG);
    // `l`: gas
    const transferGasFee = tryAsServiceGas(regs.get(TRANSFER_GAS_FEE_REG));
    // `o`: transfer memo
    const memoStart = regs.get(MEMO_START_REG);

    const memo = Bytes.zero(TRANSFER_MEMO_BYTES);
    const memoryReadResult = memory.loadInto(memo.raw, memoStart);

    // page fault while reading the memory.
    if (memoryReadResult.isError) {
      logger.trace`TRANSFER(${destination}, ${amount}, ${transferGasFee}, ${memo}) <- PANIC`;
      return PvmExecution.Panic;
    }

    const transferResult = this.partialState.transfer(destination, amount, transferGasFee, memo);
    logger.trace`TRANSFER(${destination}, ${amount}, ${transferGasFee}, ${memo}) <- ${resultToString(transferResult)}`;

    // All good!
    if (transferResult.isOk) {
      if (Compatibility.isGreaterOrEqual(GpVersion.V0_7_2)) {
        // substracting value `t`
        const underflow = gas.sub(tryAsGas(transferGasFee));
        if (underflow) {
          return PvmExecution.OOG;
        }
      }
      regs.set(IN_OUT_REG, HostCallResult.OK);
      return;
    }

    const e = transferResult.error;

    if (e === TransferError.DestinationNotFound) {
      regs.set(IN_OUT_REG, HostCallResult.WHO);
      return;
    }

    if (e === TransferError.GasTooLow) {
      regs.set(IN_OUT_REG, HostCallResult.LOW);
      return;
    }

    if (e === TransferError.BalanceBelowThreshold) {
      regs.set(IN_OUT_REG, HostCallResult.CASH);
      return;
    }

    assertNever(e);
  }
}
