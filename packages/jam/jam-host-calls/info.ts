import { type ServiceId, tryAsServiceGas } from "@typeberry/block";
import { Encoder, codec } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import type { HostCallHandler, HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { type PvmExecution, tryAsHostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas";
import { ServiceAccountInfo } from "@typeberry/state";
import { HostCallResult } from "./results";
import { CURRENT_SERVICE_ID, legacyGetServiceId } from "./utils";

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
  currentServiceId = CURRENT_SERVICE_ID;

  constructor(private readonly account: Accounts) {}

  async execute(_gas: GasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<undefined | PvmExecution> {
    // t
    const serviceId = legacyGetServiceId(IN_OUT_REG, regs, this.currentServiceId);
    // o
    const outputStart = regs.get(8);

    // t
    const accountInfo = await this.account.getInfo(serviceId);

    if (accountInfo === null) {
      regs.set(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    const encodedInfo = Encoder.encodeObject(codecServiceAccountInfoWithThresholdBalance, {
      ...accountInfo,
      thresholdBalance: ServiceAccountInfo.calculateThresholdBalance(
        accountInfo.storageUtilisationCount,
        accountInfo.storageUtilisationBytes,
      ),
    });
    const writeResult = memory.storeFrom(outputStart, encodedInfo.raw);

    regs.set(IN_OUT_REG, writeResult.isError ? HostCallResult.OOB : HostCallResult.OK);
    return;
  }
}

/**
 * Service account details with threshold balance.
 *
 * Used exclusively by `info` host call.
 *
 * https://graypaper.fluffylabs.dev/#/85129da/307902307902?v=0.6.3
 */
export const codecServiceAccountInfoWithThresholdBalance = codec.object(
  {
    codeHash: codec.bytes(HASH_SIZE),
    balance: codec.u64,
    thresholdBalance: codec.u64,
    accumulateMinGas: codec.u64.convert((i) => i, tryAsServiceGas),
    onTransferMinGas: codec.u64.convert((i) => i, tryAsServiceGas),
    storageUtilisationBytes: codec.u64,
    storageUtilisationCount: codec.u32,
  },
  "ServiceAccountInfoWithThresholdBalance",
);
