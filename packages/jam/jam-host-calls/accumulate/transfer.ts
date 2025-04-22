import { tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { tryAsU64, tryBigIntAsNumber } from "@typeberry/numbers";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import {
  type HostCallMemory,
  type HostCallRegisters,
  PvmExecution,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type BigGas, type Gas, type GasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { asOpaqueType, assertNever } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import { type AccumulationPartialState, TRANSFER_MEMO_BYTES, TransferError } from "./partial-state";

const IN_OUT_REG = 7; // `d`
const AMOUNT_REG = 8; // `a`
const ON_TRANSFER_GAS_REG = 9; // `l`
const MEMO_START_REG = 10; // `o`

/**
 * Transfer balance from one service account to another.
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/32d10132d101?v=0.6.4
 */
export class Transfer implements HostCallHandler {
  index = tryAsHostCallIndex(11);
  /**
   * `g = 10 + ω9`
   *
   * https://graypaper.fluffylabs.dev/#/68eaa1f/32d20132d501?v=0.6.4
   */
  gasCost = (regs: HostCallRegisters): Gas => {
    const gas = tryAsU64(10) + regs.get(ON_TRANSFER_GAS_REG);
    return tryAsGas(gas);
  };
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(_gas: GasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<undefined | PvmExecution> {
    // `d`: destination
    const destination = tryAsServiceId(tryBigIntAsNumber(regs.get(IN_OUT_REG)));
    // `a`: amount
    const amount = regs.get(AMOUNT_REG);
    // `l`: gas
    const onTransferGas: BigGas = asOpaqueType(regs.get(ON_TRANSFER_GAS_REG));
    // `o`: transfer memo
    const memoStart = regs.get(MEMO_START_REG);

    const memo = Bytes.zero(TRANSFER_MEMO_BYTES);
    const memoryReadResult = memory.loadInto(memo.raw, memoStart);

    // page fault while reading the memory.
    if (memoryReadResult.isError) {
      return PvmExecution.Panic;
    }

    const transferResult = this.partialState.transfer(destination, amount, onTransferGas, memo);

    // All good!
    if (transferResult.isOk) {
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
