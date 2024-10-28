import type { CodeHash, ServiceId } from "@typeberry/block";
import { type CodecRecord, Encoder, codec } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import type { U32, U64 } from "@typeberry/numbers";
import type { HostCallHandler } from "@typeberry/pvm-host-calls";
import type { HostCallIndex } from "@typeberry/pvm-host-calls/host-call-handler";
import type { Gas, GasCounter, SmallGas } from "@typeberry/pvm-interpreter/gas";
import { type Memory, createMemoryIndex } from "@typeberry/pvm-interpreter/memory";
import type { Registers } from "@typeberry/pvm-interpreter/registers";
import { WithDebug } from "@typeberry/utils";
import { HostCallResult } from "./results";
import { getServiceId } from "./utils";

/**
 * Service account details.
 *
 * TODO [ToDr] These things may not necessarily be in a single class.
 * In case some of the things are computed (and the computation may be heavy)
 * this should be split.
 *
 * https://graypaper.fluffylabs.dev/#/439ca37/10e70010e700
 */
export class AccountInfo extends WithDebug {
  static Codec = codec.Class(AccountInfo, {
    codeHash: codec.bytes(HASH_SIZE).cast(),
    balance: codec.u64,
    thresholdBalance: codec.u64,
    accumulateMinGas: codec.u64.convert(
      (g) => BigInt(g) as U64,
      (i) => BigInt(i) as Gas,
    ),
    onTransferMinGas: codec.u64.convert(
      (g) => BigInt(g) as U64,
      (i) => BigInt(i) as Gas,
    ),
    storageUtilisationBytes: codec.u64,
    storageUtilisationCount: codec.u32,
  });

  static fromCodec(a: CodecRecord<AccountInfo>) {
    return new AccountInfo(
      a.codeHash,
      a.balance,
      a.thresholdBalance,
      a.accumulateMinGas,
      a.onTransferMinGas,
      a.storageUtilisationBytes,
      a.storageUtilisationCount,
    );
  }

  /** `a_t = BS + BI * a_i + BL * a_l` */
  static calculateThresholdBalance(items: U32, bytes: U64): U64 {
    /** https://graypaper.fluffylabs.dev/#/439ca37/3d30003d3000 */
    const B_S = 100n;
    /** https://graypaper.fluffylabs.dev/#/439ca37/3d28003d2800 */
    const B_I = 10n;
    /** https://graypaper.fluffylabs.dev/#/439ca37/3d2c003d2d00 */
    const B_L = 1n;

    // TODO [ToDr] Overflows?
    return (B_S + B_I * BigInt(items) + B_L * bytes) as U64;
  }

  constructor(
    /** `a_c`: Hash of the service code. */
    public readonly codeHash: CodeHash,
    /** `a_b`: Current account balance. */
    public readonly balance: U64,
    /** `a_t`: Balance required to keep all of the current storage items. */
    public readonly thresholdBalance: U64,
    /** `a_g`: Minimal gas required to execute Accumulate entrypoint. */
    public readonly accumulateMinGas: Gas,
    /** `a_m`: Minimal gas required to execute On Transfer entrypoint. */
    public readonly onTransferMinGas: Gas,
    /** `a_l`: Total number of octets in storage. */
    public readonly storageUtilisationBytes: U64,
    /** `a_i`: Number of items in storage. */
    public readonly storageUtilisationCount: U32,
  ) {
    super();
  }
}

/** Account data interface for Info host call. */
export interface Accounts {
  /** Get account info. */
  getInfo(serviceId: ServiceId): Promise<AccountInfo | null>;
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
 * https://graypaper.fluffylabs.dev/#/439ca37/2d45022d4502
 */
export class Info implements HostCallHandler {
  index = 4 as HostCallIndex;
  gasCost = 10 as SmallGas;
  currentServiceId = (2 ** 32 - 1) as ServiceId;

  constructor(private readonly account: Accounts) {}

  async execute(_gas: GasCounter, regs: Registers, memory: Memory): Promise<void> {
    // t
    const serviceId = getServiceId(IN_OUT_REG, regs, this.currentServiceId);
    // o
    const outputStart = createMemoryIndex(regs.asUnsigned[8]);

    // t
    const accountInfo = await this.account.getInfo(serviceId);

    if (accountInfo === null) {
      regs.asUnsigned[IN_OUT_REG] = HostCallResult.NONE;
      return Promise.resolve();
    }

    const encodedInfo = Encoder.encodeObject(AccountInfo.Codec, accountInfo);
    const writeOk = memory.storeFrom(outputStart, encodedInfo.buffer);

    regs.asUnsigned[IN_OUT_REG] = writeOk !== null ? HostCallResult.OOB : HostCallResult.OK;
    return Promise.resolve();
  }
}
