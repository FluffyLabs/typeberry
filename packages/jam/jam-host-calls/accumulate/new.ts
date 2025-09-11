import { type ServiceId, tryAsServiceGas } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import { Compatibility, GpVersion, assertNever, resultToString } from "@typeberry/utils";
import { NewServiceError, type PartialState } from "../externalities/partial-state.js";
import { logger } from "../logger.js";
import { HostCallResult } from "../results.js";

const IN_OUT_REG = 7;

/**
 * Create a new service account.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/367502367502?v=0.6.7
 */
export class New implements HostCallHandler {
  index = tryAsHostCallIndex(
    Compatibility.selectIfGreaterOrEqual({
      fallback: 9,
      versions: {
        [GpVersion.V0_6_7]: 18,
      },
    }),
  );
  gasCost = tryAsSmallGas(10);
  tracedRegisters = traceRegisters(IN_OUT_REG, 8, 9, 10, 11);

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
    // `l`
    const codeLength = regs.get(8);
    // `g`
    const gas = tryAsServiceGas(regs.get(9));
    // `m`
    const allowance = tryAsServiceGas(regs.get(10));
    // `f`
    const gratisStorage = regs.get(11);

    // `c`
    const codeHash = Bytes.zero(HASH_SIZE);
    const memoryReadResult = memory.loadInto(codeHash.raw, codeHashStart);
    // error while reading the memory.
    if (memoryReadResult.isError) {
      logger.trace(`NEW(${codeHash}, ${codeLength}, ${gas}, ${allowance}, ${gratisStorage}) <- PANIC`);
      return PvmExecution.Panic;
    }

    const assignedId = this.partialState.newService(codeHash.asOpaque(), codeLength, gas, allowance, gratisStorage);
    logger.trace(
      `NEW(${codeHash}, ${codeLength}, ${gas}, ${allowance}, ${gratisStorage}) <- ${resultToString(assignedId)}`,
    );

    if (assignedId.isOk) {
      regs.set(IN_OUT_REG, tryAsU64(assignedId.ok));
      return;
    }

    const e = assignedId.error;

    if (e === NewServiceError.InsufficientFunds) {
      regs.set(IN_OUT_REG, HostCallResult.CASH);
      return;
    }

    if (e === NewServiceError.UnprivilegedService) {
      regs.set(IN_OUT_REG, HostCallResult.HUH);
      return;
    }

    assertNever(e);
  }
}
