import { tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import {
  type HostCallMemory,
  type HostCallRegisters,
  PvmExecution,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { assertNever } from "@typeberry/utils";
import { type AccumulationPartialState, QuitError, TRANSFER_MEMO_BYTES } from "../externalities/partial-state";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";

const IN_OUT_REG = 7;

/**
 * Remove the current service id and transfer or burn the remaining account balance to some other account.
 *
 * TODO [ToDr] Update to latest GP
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/32c10232c102
 */
export class Eject implements HostCallHandler {
  index = tryAsHostCallIndex(12);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(gas: GasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<undefined | PvmExecution> {
    // `d`: where to transfer remaining funds
    const destination = tryAsServiceId(Number(regs.get(IN_OUT_REG)));

    const noTransfer = destination === this.currentServiceId || destination === CURRENT_SERVICE_ID;

    // we burn the remaining funds, no transfer added.
    if (noTransfer) {
      this.partialState.quitAndBurn();
      regs.set(IN_OUT_REG, HostCallResult.OK);
      return PvmExecution.Halt;
    }

    // when we transfer it's more complicated, we need to handle
    // some extra cases, because the transfer might fail.

    // `o`: memo start memory index
    const memoStart = regs.get(8);
    // `g`: onTransfer gas
    const remainingGas = gas.get();
    // `m`: transfer memo (message)
    const memo = Bytes.zero(TRANSFER_MEMO_BYTES);
    const memoryReadResult = memory.loadInto(memo.raw, memoStart);
    if (memoryReadResult.isError) {
      return PvmExecution.Panic;
    }

    // `a`: balance - threshold + B_S: basic minimum balance
    const transferResult = this.partialState.quitAndTransfer(destination, remainingGas, memo);

    // All good!
    if (transferResult.isOk) {
      regs.set(IN_OUT_REG, HostCallResult.OK);
      return PvmExecution.Halt;
    }

    const e = transferResult.error;

    if (e === QuitError.DestinationNotFound) {
      regs.set(IN_OUT_REG, HostCallResult.WHO);
      return;
    }

    if (e === QuitError.GasTooLow) {
      regs.set(IN_OUT_REG, HostCallResult.LOW);
      return;
    }

    assertNever(e);
  }
}
