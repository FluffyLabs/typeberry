import { tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import { PvmExecution, type Registers, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { type Memory, tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { assertNever } from "@typeberry/utils";
import { HostCallResult } from "../results";
import { CURRENT_SERVICE_ID } from "../utils";
import { type AccumulationPartialState, QuitError, TRANSFER_MEMO_BYTES } from "./partial-state";

const IN_OUT_REG = 7;

/**
 * Remove the current service id and transfer or burn the remaining account balance to some other account.
 *
 * TODO [ToDr] Rename to eject
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/32c10232c102
 */
export class Quit implements HostCallHandler {
  index = tryAsHostCallIndex(12);
  gasCost = tryAsSmallGas(10);
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly partialState: AccumulationPartialState) {}

  async execute(gas: GasCounter, regs: Registers, memory: Memory): Promise<undefined | PvmExecution> {
    // `d`: where to transfer remaining funds
    const destination = tryAsServiceId(regs.getU32(IN_OUT_REG));

    const noTransfer = destination === this.currentServiceId || destination === CURRENT_SERVICE_ID;

    // we burn the remaining funds, no transfer added.
    if (noTransfer) {
      this.partialState.quitAndBurn();
      regs.setU32(IN_OUT_REG, HostCallResult.OK);
      return Promise.resolve(PvmExecution.Halt);
    }

    // when we transfer it's more complicated, we need to handle
    // some extra cases, because the transfer might fail.

    // `o`: memo start memory index
    const memoStart = tryAsMemoryIndex(regs.getU32(8));
    // `g`: onTransfer gas
    const remainingGas = gas.get();
    // `m`: transfer memo (message)
    const memo = Bytes.zero(TRANSFER_MEMO_BYTES);
    const pageFault = memory.loadInto(memo.raw, memoStart);
    if (pageFault !== null) {
      regs.setU32(IN_OUT_REG, HostCallResult.OOB);
      return;
    }

    // `a`: balance - threshold + B_S: basic minimum balance
    const transferResult = this.partialState.quitAndTransfer(destination, remainingGas, memo);

    // All good!
    if (transferResult.isOk) {
      regs.setU32(IN_OUT_REG, HostCallResult.OK);
      return Promise.resolve(PvmExecution.Halt);
    }

    const e = transferResult.error;

    if (e === QuitError.DestinationNotFound) {
      regs.setU32(IN_OUT_REG, HostCallResult.WHO);
      return;
    }

    if (e === QuitError.GasTooLow) {
      regs.setU32(IN_OUT_REG, HostCallResult.LOW);
      return;
    }

    assertNever(e);
  }
}
