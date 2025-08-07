import { type ServiceId, tryAsServiceGas } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU64 } from "@typeberry/numbers";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler.js";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import { Compatibility, GpVersion, assertNever } from "@typeberry/utils";
import { NewServiceError, type PartialState } from "../externalities/partial-state.js";
import { HostCallResult } from "../results.js";

const IN_OUT_REG = 7;

/**
 * Create a new service account.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/364602364602?v=0.6.6
 */
export class New implements HostCallHandler {
  index = tryAsHostCallIndex(9);
  gasCost = tryAsSmallGas(10);

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
    const gratisStorage = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7) ? regs.get(11) : tryAsU64(0);

    // `c`
    const codeHash = Bytes.zero(HASH_SIZE);
    const memoryReadResult = memory.loadInto(codeHash.raw, codeHashStart);
    // error while reading the memory.
    if (memoryReadResult.isError) {
      return PvmExecution.Panic;
    }

    const assignedId = this.partialState.newService(codeHash.asOpaque(), codeLength, gas, allowance, gratisStorage);

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
