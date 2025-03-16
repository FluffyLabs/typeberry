import type { CodeHash, ServiceId } from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import { type U32, type U64, tryAsU64 } from "@typeberry/numbers";
import type { Gas } from "@typeberry/pvm-interpreter/gas";
import { WithDebug, asOpaqueType } from "@typeberry/utils";

/**
 * Service account details.
 *
 * - `c`: Hash of the service code.
 * - `b`: Current account balance.
 * - `t`: Balance required to keep all of the current storage items.
 * - `g`: Minimal gas required to execute Accumulate entrypoint.
 * - `m`: Minimal gas required to execute On Transfer entrypoint.
 * - `i`: Number of items in storage.
 * - `o`: Total number of octets in storage.
 *
 * TODO [ToDr] These things may not necessarily be in a single class.
 * In case some of the things are computed (and the computation may be heavy)
 * this should be split.
 *
 * https://graypaper.fluffylabs.dev/#/85129da/105a01105a01?v=0.6.3
 * https://graypaper.fluffylabs.dev/#/85129da/116e01116e01?v=0.6.3
 */
export class ServiceAccountInfo extends WithDebug {
  static Codec = codec.Class(ServiceAccountInfo, {
    /** `c` */
    codeHash: codec.bytes(HASH_SIZE).asOpaque(),
    /** `b` */
    balance: codec.u64,
    /** `t`
     *
     * NOTE [ToDr] this can be either stored or recomputed,
     * however we need to encode that for the `info` host call.
     */
    thresholdBalance: codec.u64,
    /** `g` */
    accumulateMinGas: codec.u64.convert(
      (g) => tryAsU64(g),
      (i) => asOpaqueType<"BigGas[U64]", U64>(i),
    ),
    /** `m` */
    onTransferMinGas: codec.u64.convert(
      (g) => tryAsU64(g),
      (i) => asOpaqueType<"BigGas[U64]", U64>(i),
    ),
    /** `i` */
    storageUtilisationCount: codec.u32,
    /** `o` */
    storageUtilisationBytes: codec.u64,
  });

  static fromCodec(a: CodecRecord<ServiceAccountInfo>) {
    return new ServiceAccountInfo(
      a.codeHash,
      a.balance,
      a.thresholdBalance,
      a.accumulateMinGas,
      a.onTransferMinGas,
      a.storageUtilisationBytes,
      a.storageUtilisationCount,
    );
  }

  /**
   * `a_t = BS + BI * a_i + BL * a_o`
   *
   * https://graypaper.fluffylabs.dev/#/85129da/115e01116201?v=0.6.3
   */
  static calculateThresholdBalance(items: U32, bytes: U64): U64 {
    /** https://graypaper.fluffylabs.dev/#/85129da/413e00413e00?v=0.6.3 */
    const B_S = 100n;
    /** https://graypaper.fluffylabs.dev/#/85129da/413600413600?v=0.6.3 */
    const B_I = 10n;
    /** https://graypaper.fluffylabs.dev/#/85129da/413a00413b00?v=0.6.3 */
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
    /** `a_o`: Total number of octets in storage. */
    public readonly storageUtilisationBytes: U64,
    /** `a_i`: Number of items in storage. */
    public readonly storageUtilisationCount: U32,
  ) {
    super();
  }
}

/**
 * Preimage dictionary entry.
 *
 * `δ[s]_p[h]`
 *
 * https://graypaper.fluffylabs.dev/#/85129da/115200115300?v=0.6.3
 * https://graypaper.fluffylabs.dev/#/85129da/116100116100?v=0.6.3
 */
export class PreimageItem extends WithDebug {
  static Codec = codec.Class(PreimageItem, {
    /** `h` */
    hash: codec.bytes(HASH_SIZE).asOpaque(),
    /** `p` */
    blob: codec.blob,
  });

  static fromCodec({ hash, blob }: CodecRecord<PreimageItem>) {
    return new PreimageItem(hash, blob);
  }

  constructor(
    /**
     * Preimage hash.
     *
     * `h`
     */
    readonly hash: PreimageHash,
    /**
     * Preimage data.
     *
     * `p`
     */
    readonly blob: BytesBlob,
  ) {
    super();
  }
}

/**
 * Service dictionary entry.
 *
 * `δ[s]`
 *
 * https://graypaper.fluffylabs.dev/#/85129da/10c80010cc00?v=0.6.3
 */
export class Service extends WithDebug {
  static Codec = codec.Class(Service, {
    /** `s` */
    id: codec.u32.asOpaque(),
    /** `A` */
    data: codec.object({ service: ServiceAccountInfo.Codec, preimages: codec.sequenceVarLen(PreimageItem.Codec) }),
  });

  static fromCodec({ id, data }: CodecRecord<Service>) {
    return new Service(id, data);
  }

  constructor(
    /**
     * Service id.
     *
     * `s`
     *
     * NOTE Service id `s`(cursive), not storage dictionary `s`(bold).
     */
    readonly id: ServiceId,
    /**
     * Service details.
     *
     * `A`
     *
     * https://graypaper.fluffylabs.dev/#/85129da/105a01105a01?v=0.6.3
     */
    readonly data: { service: ServiceAccountInfo; preimages: PreimageItem[] },
  ) {
    super();
  }
}
