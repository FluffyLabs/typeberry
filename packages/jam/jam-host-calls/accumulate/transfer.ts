import { type ServiceId, tryAsServiceGas } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type Gas, type GasCounter, tryAsGas } from "@typeberry/pvm-interpreter/gas.js";
import { Compatibility, GpVersion, assertNever, resultToString } from "@typeberry/utils";
import { type PartialState, TRANSFER_MEMO_BYTES, TransferError } from "../externalities/partial-state.js";
import { logger } from "../logger.js";
import { HostCallResult } from "../results.js";
import { getServiceId } from "../utils.js";

const IN_OUT_REG = 7; // `d`
const AMOUNT_REG = 8; // `a`
const ON_TRANSFER_GAS_REG = 9; // `l`
const MEMO_START_REG = 10; // `o`

/**
 * Transfer balance from one service account to another.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/373b00373b00?v=0.6.7
 */
export class Transfer implements HostCallHandler {
  index = tryAsHostCallIndex(
    Compatibility.selectIfGreaterOrEqual({
      fallback: 11,
      versions: {
        [GpVersion.V0_6_7]: 20,
      },
    }),
  );
  /**
   * `g = 10 + ω9`
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/373d00373d00?v=0.6.7
   */
  gasCost = (regs: IHostCallRegisters): Gas => {
    const gas = 10n + regs.get(ON_TRANSFER_GAS_REG);
    return tryAsGas(gas);
  };

  tracedRegisters = traceRegisters(IN_OUT_REG, AMOUNT_REG, ON_TRANSFER_GAS_REG, MEMO_START_REG);

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly partialState: PartialState,
  ) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<undefined | PvmExecution> {
    // `d`: destination
    const destination = getServiceId(regs.get(IN_OUT_REG));
    // `a`: amount
    const amount = regs.get(AMOUNT_REG);
    // `l`: gas
    const onTransferGas = tryAsServiceGas(regs.get(ON_TRANSFER_GAS_REG));
    // `o`: transfer memo
    const memoStart = regs.get(MEMO_START_REG);

    const memo = Bytes.zero(TRANSFER_MEMO_BYTES);
    const memoryReadResult = memory.loadInto(memo.raw, memoStart);

    // page fault while reading the memory.
    if (memoryReadResult.isError) {
      logger.trace(`TRANSFER(${destination}, ${amount}, ${onTransferGas}, ${memo}) <- PANIC`);
      return PvmExecution.Panic;
    }

    const transferResult = this.partialState.transfer(destination, amount, onTransferGas, memo);
    logger.trace(`TRANSFER(${destination}, ${amount}, ${onTransferGas}, ${memo}) <- ${resultToString(transferResult)}`);

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
