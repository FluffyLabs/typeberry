import type { CodeHash } from "@typeberry/block";
import { type CodecRecord, codec } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import { type U32, type U64, tryAsU64 } from "@typeberry/numbers";
import type { Gas } from "@typeberry/pvm-interpreter/gas";
import { WithDebug, asOpaqueType } from "@typeberry/utils";

/**
 * Service account details.
 *
 * TODO [ToDr] These things may not necessarily be in a single class.
 * In case some of the things are computed (and the computation may be heavy)
 * this should be split.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/105a01105a01
 */
export class AccountInfo extends WithDebug {
  static Codec = codec.Class(AccountInfo, {
    codeHash: codec.bytes(HASH_SIZE).asOpaque(),
    balance: codec.u64,
    thresholdBalance: codec.u64,
    accumulateMinGas: codec.u64.convert(
      (g) => tryAsU64(g),
      (i) => asOpaqueType<"BigGas[U64]", U64>(i),
    ),
    onTransferMinGas: codec.u64.convert(
      (g) => tryAsU64(g),
      (i) => asOpaqueType<"BigGas[U64]", U64>(i),
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
    /** https://graypaper.fluffylabs.dev/#/579bd12/413e00413e00 */
    const B_S = 100n;
    /** https://graypaper.fluffylabs.dev/#/579bd12/413600413600 */
    const B_I = 10n;
    /** https://graypaper.fluffylabs.dev/#/579bd12/413a00413b00 */
    const B_L = 1n;

    // TODO [ToDr] Overflows?
    return tryAsU64(B_S + B_I * BigInt(items) + B_L * bytes);
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
