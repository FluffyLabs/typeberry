import { type ServiceId, tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { Encoder, codec } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import { ServiceAccountInfo } from "@typeberry/state";
import { Compatibility, GpVersion } from "@typeberry/utils";
import { logger } from "./logger.js";
import { HostCallResult } from "./results.js";
import { getServiceIdOrCurrent } from "./utils.js";

/** Account data interface for info host calls. */
export interface AccountsInfo {
  /** Get account info. */
  getServiceInfo(serviceId: ServiceId | null): ServiceAccountInfo | null;
}

const IN_OUT_REG = 7;

/**
 * Return info about some account.
 *
 * `E(t_c, E8(t_b, t_t, t_g , t_m, t_o), E4(t_i), E8(t_f), E4(t_r, t_a, t_p))`
 * c = code hash
 * b = balance
 * t = threshold balance
 * g = minimum gas for accumulate
 * m = minimum gas for on transfer
 * i = number of items in the storage
 * o = total number of octets stored.
 * f = gratis storage (can bring down whole threshold cost to zero)
 * r = creation timeslot
 * a = last accumulation timeslot
 * p = parent service
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/332702332702?v=0.6.7
 */
export class Info implements HostCallHandler {
  index = tryAsHostCallIndex(
    Compatibility.selectIfGreaterOrEqual({
      fallback: 4,
      versions: {
        [GpVersion.V0_6_7]: 5,
      },
    }),
  );
  gasCost = tryAsSmallGas(10);
  tracedRegisters = traceRegisters(IN_OUT_REG, 8);

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly account: AccountsInfo,
  ) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<undefined | PvmExecution> {
    // t
    const serviceId = getServiceIdOrCurrent(IN_OUT_REG, regs, this.currentServiceId);
    // o
    const outputStart = regs.get(8);

    // t
    const accountInfo = this.account.getServiceInfo(serviceId);

    const encodedInfo =
      accountInfo === null
        ? BytesBlob.empty()
        : Encoder.encodeObject(codecServiceAccountInfoWithThresholdBalance, {
            ...accountInfo,
            thresholdBalance: ServiceAccountInfo.calculateThresholdBalance(
              accountInfo.storageUtilisationCount,
              accountInfo.storageUtilisationBytes,
              accountInfo.gratisStorage,
            ),
          });

    logger.trace(`INFO(${serviceId}) <- ${encodedInfo}`);

    const writeResult = memory.storeFrom(outputStart, encodedInfo.raw);
    if (writeResult.isError) {
      return PvmExecution.Panic;
    }

    if (accountInfo === null) {
      regs.set(IN_OUT_REG, HostCallResult.NONE);
      return;
    }

    regs.set(IN_OUT_REG, HostCallResult.OK);
  }
}

/**
 * Service account details with threshold balance.
 *
 * Used exclusively by `info` host call.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/337602337602?v=0.6.7
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
    gratisStorage: codec.u64,
    created: codec.u32.convert((x) => x, tryAsTimeSlot),
    lastAccumulation: codec.u32.convert((x) => x, tryAsTimeSlot),
    parentService: codec.u32.convert((x) => x, tryAsServiceId),
  },
  "ServiceAccountInfoWithThresholdBalance",
);
