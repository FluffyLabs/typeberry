import type { ServiceId } from "@typeberry/block";
import { Encoder } from "@typeberry/codec";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import {
  type Memory,
  type PvmExecution,
  type Registers,
  tryAsHostCallIndex,
} from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { tryAsMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import { ServiceAccountInfo } from "@typeberry/state";
import { LegacyHostCallResult } from "./results";
import { LEGACY_CURRENT_SERVICE_ID, legacyGetServiceId } from "./utils";

/** Account data interface for Info host call. */
export interface Accounts {
  /** Get account info. */
  getInfo(serviceId: ServiceId): Promise<ServiceAccountInfo | null>;
}

const IN_OUT_REG = 7;

/**
 * Return info about some account.
 *
 * `E(t_c, t_b, t_t, t_g , t_m, t_l, t_i)`
 * c = code hash
 * b = balance
 * t = threshold balance
 * g = minimum gas for accumulate
 * m = minimum gas for on transfer
 * i = number of items in the storage
 * l = total number of octets stored.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/313b00313b00
 */
export class Info implements HostCallHandler {
  index = tryAsHostCallIndex(4);
  gasCost = tryAsSmallGas(10);
  currentServiceId = LEGACY_CURRENT_SERVICE_ID;

  constructor(private readonly account: Accounts) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<undefined | PvmExecution> {
    // t
    const serviceId = legacyGetServiceId(IN_OUT_REG, regs, this.currentServiceId);
    // o
    const outputStart = tryAsMemoryIndex(regs.getU32(8));

    // t
    const accountInfo = await this.account.getInfo(serviceId);

    if (accountInfo === null) {
      regs.setU32(IN_OUT_REG, LegacyHostCallResult.NONE);
      return;
    }

    const encodedInfo = Encoder.encodeObject(ServiceAccountInfo.Codec, accountInfo);
    const writeOk = memory.storeFrom(outputStart, encodedInfo.raw);

    regs.setU32(IN_OUT_REG, writeOk !== null ? LegacyHostCallResult.OOB : LegacyHostCallResult.OK);
    return;
  }
}
