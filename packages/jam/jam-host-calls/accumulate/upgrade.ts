import type { ServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import type { PartialState } from "../externalities/partial-state.js";
import { logger } from "../logger.js";
import { HostCallResult } from "../results.js";

const IN_OUT_REG = 7; // `o`
const GAS_REG = 8; // `g`
const ALLOWANCE_REG = 9; // `m`

/**
 * Upgrade the code of the service.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/36d00336d003?v=0.6.7
 */
export class Upgrade implements HostCallHandler {
  index = tryAsHostCallIndex(19);
  basicGasCost = tryAsSmallGas(10);
  tracedRegisters = traceRegisters(IN_OUT_REG, GAS_REG, ALLOWANCE_REG);

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly partialState: PartialState,
  ) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<undefined | PvmExecution> {
    // `o`
    const codeHashStart = regs.get(IN_OUT_REG);
    // `g`
    const gas = regs.get(GAS_REG);
    // `m`
    const allowance = regs.get(ALLOWANCE_REG);

    // `c`
    const codeHash = Bytes.zero(HASH_SIZE);
    const memoryReadResult = memory.loadInto(codeHash.raw, codeHashStart);
    if (memoryReadResult.isError) {
      logger.trace(`UPGRADE(${codeHash}, ${gas}, ${allowance}) <- PANIC`);
      return PvmExecution.Panic;
    }

    this.partialState.upgradeService(codeHash.asOpaque(), gas, allowance);
    logger.trace(`UPGRADE(${codeHash}, ${gas}, ${allowance})`);

    regs.set(IN_OUT_REG, HostCallResult.OK);
  }
}
