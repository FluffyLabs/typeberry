import { Bytes } from "@typeberry/bytes";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type Gas, type GasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas";
import { assertNever } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID, getServiceIdFromU64 } from "../utils";
import { type AccumulationPartialState, TRANSFER_MEMO_BYTES, TransferError } from "./partial-state";

const IN_OUT_REG = 7; // `d`
const AMOUNT_REG = 8; // `a`
const ON_TRANSFER_GAS_REG = 9; // `l`
const MEMO_START_REG = 10; // `o`

/**
 * Transfer balance from one service account to another.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/373b00373b00?v=0.6.6
 */
export class Transfer implements HostCallHandler {
  index = tryAsHostCallIndex(11);
  /**
   * `g = 10 + ω9`
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/373d00373d00?v=0.6.6
   */
  gasCost = (regs: IHostCallRegisters): Gas => {
    const gas = 10n + regs.get(ON_TRANSFER_GAS_REG);
    return tryAsGas(gas);
  };
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<undefined | PvmExecution> {
    // `d`: destination
    const destination = getServiceIdFromU64(regs.get(IN_OUT_REG));
    // `a`: amount
    const amount = regs.get(AMOUNT_REG);
    // `l`: gas
    const onTransferGas = tryAsGas(regs.get(ON_TRANSFER_GAS_REG));
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
