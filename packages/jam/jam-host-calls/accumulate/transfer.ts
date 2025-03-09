import { tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { tryAsU32, u64FromParts } from "@typeberry/numbers";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import {
  type Memory,
  type PvmExecution,
  type Registers,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls/host-call-handler";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter";
import { type BigGas, type Gas, type GasCounter, tryAsGas, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { asOpaqueType, assertNever } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import { type AccumulationPartialState, TRANSFER_MEMO_BYTES, TransferError } from "./partial-state";

const IN_OUT_REG = 7;
const AMOUNT_LOW_REG = 8;
const AMOUNT_HIG_REG = 9;

/**
 * Transfer balance from one service account to another.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/32c20132c201
 */
export class Transfer implements HostCallHandler {
  index = tryAsHostCallIndex(11);
  /**
   * `g = 10 + ω8 + 2**32 * ω9`
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/32c30132c601
   */
  gasCost = (regs: Registers): Gas => {
    const smallGas = 10 + regs.getU32(AMOUNT_LOW_REG);
    const big = regs.getU32(AMOUNT_HIG_REG);
    if (big === 0 && smallGas < 2 ** 32) {
      return tryAsSmallGas(smallGas);
    }

    return tryAsGas(BigInt(big) * 2n ** 32n + BigInt(smallGas));
  };
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(gas: GasCounter, regs: Registers, memory: Memory): Promise<undefined | PvmExecution> {
    // `d`: destination
    const destination = tryAsServiceId(regs.getU32(IN_OUT_REG));
    // amount
    const a_l = tryAsU32(regs.getU32(AMOUNT_LOW_REG));
    const a_h = tryAsU32(regs.getU32(AMOUNT_HIG_REG));
    // gas
    const g_l = tryAsU32(regs.getU32(10));
    const g_h = tryAsU32(regs.getU32(11));
    // `o`: transfer memo
    const memoStart = tryAsMemoryIndex(regs.getU32(12));

    const memo = Bytes.zero(TRANSFER_MEMO_BYTES);
    const pageFault = memory.loadInto(memo.raw, memoStart);
    // page fault while reading the memory.
    if (pageFault !== null) {
      regs.setU32(IN_OUT_REG, HostCallResult.OOB);
      return;
    }

    const amount = u64FromParts({ lower: a_l, upper: a_h });
    const onTransferGas: BigGas = asOpaqueType(u64FromParts({ lower: g_l, upper: g_h }));

    // We don't have enough gas left
    if (gas.get() < onTransferGas) {
      regs.setU32(IN_OUT_REG, HostCallResult.HIGH);
      return;
    }

    const transferResult = this.partialState.transfer(destination, amount, onTransferGas, memo);

    // All good!
    if (transferResult.isOk) {
      regs.setU32(IN_OUT_REG, HostCallResult.OK);
      return;
    }

    const e = transferResult.error;

    if (e === TransferError.DestinationNotFound) {
      regs.setU32(IN_OUT_REG, HostCallResult.WHO);
      return;
    }

    if (e === TransferError.GasTooLow) {
      regs.setU32(IN_OUT_REG, HostCallResult.LOW);
      return;
    }

    if (e === TransferError.BalanceBelowThreshold) {
      regs.setU32(IN_OUT_REG, HostCallResult.CASH);
      return;
    }

    assertNever(e);
  }
}
