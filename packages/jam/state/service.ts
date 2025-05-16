import { type CodeHash, type ServiceGas, type ServiceId, type TimeSlot, tryAsServiceGas } from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import { type HashDictionary, type KnownSizeArray, asKnownSize } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import { type U32, type U64, tryAsU64 } from "@typeberry/numbers";
import { WithDebug } from "@typeberry/utils";
import type { StateKey } from "../state-merkleization/keys";

/**
 * Service account details.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/106001106001?v=0.6.6
 */
export class ServiceAccountInfo extends WithDebug {
  static Codec = codec.Class(ServiceAccountInfo, {
    codeHash: codec.bytes(HASH_SIZE).asOpaque<CodeHash>(),
    balance: codec.u64,
    accumulateMinGas: codec.u64.convert((x) => x, tryAsServiceGas),
    onTransferMinGas: codec.u64.convert((x) => x, tryAsServiceGas),
    storageUtilisationBytes: codec.u64,
    storageUtilisationCount: codec.u32,
  });

  static create(a: CodecRecord<ServiceAccountInfo>) {
    return new ServiceAccountInfo(
      a.codeHash,
      a.balance,
      a.accumulateMinGas,
      a.onTransferMinGas,
      a.storageUtilisationBytes,
      a.storageUtilisationCount,
    );
  }

  /**
   * `a_t = BS + BI * a_i + BL * a_o`
   * https://graypaper.fluffylabs.dev/#/9a08063/117201117201?v=0.6.6
   */
  static calculateThresholdBalance(items: U32, bytes: U64): U64 {
    /** https://graypaper.fluffylabs.dev/#/9a08063/445100445100?v=0.6.6 */
    const B_S = 100n;
    /** https://graypaper.fluffylabs.dev/#/9a08063/444900444900?v=0.6.6 */
    const B_I = 10n;
    /** https://graypaper.fluffylabs.dev/#/9a08063/444d00444d00?v=0.6.6 */
    const B_L = 1n;
    return tryAsU64(B_S + B_I * BigInt(items) + B_L * bytes);
  }

  private constructor(
    /** `a_c`: Hash of the service code. */
    public readonly codeHash: CodeHash,
    /** `a_b`: Current account balance. */
    public readonly balance: U64,
    /** `a_g`: Minimal gas required to execute Accumulate entrypoint. */
    public readonly accumulateMinGas: ServiceGas,
    /** `a_m`: Minimal gas required to execute On Transfer entrypoint. */
    public readonly onTransferMinGas: ServiceGas,
    /** `a_o`: Total number of octets in storage. */
    public readonly storageUtilisationBytes: U64,
    /** `a_i`: Number of items in storage. */
    public readonly storageUtilisationCount: U32,
  ) {
    super();
  }
}

export class PreimageItem extends WithDebug {
  static Codec = codec.Class(PreimageItem, {
    hash: codec.bytes(HASH_SIZE).asOpaque<PreimageHash>(),
    blob: codec.blob,
  });

  static create({ hash, blob }: CodecRecord<PreimageItem>) {
    return new PreimageItem(hash, blob);
  }

  private constructor(
    readonly hash: PreimageHash,
    readonly blob: BytesBlob,
  ) {
    super();
  }
}

export class StateItem extends WithDebug {
  static Codec = codec.Class(StateItem, {
    hash: codec.bytes(HASH_SIZE).asOpaque<StateKey>(),
    blob: codec.blob,
  });

  static create({ hash, blob }: CodecRecord<StateItem>) {
    return new StateItem(hash, blob);
  }

  private constructor(
    readonly hash: StateKey,
    readonly blob: BytesBlob,
  ) {
    super();
  }
}

const MAX_LOOKUP_HISTORY_SLOTS = 3;
export type LookupHistorySlots = KnownSizeArray<TimeSlot, `0-${typeof MAX_LOOKUP_HISTORY_SLOTS} timeslots`>;
export function tryAsLookupHistorySlots(items: TimeSlot[]): LookupHistorySlots {
  const knownSize = asKnownSize(items) as LookupHistorySlots;
  if (knownSize.length > MAX_LOOKUP_HISTORY_SLOTS) {
    throw new Error(`Lookup history items must contain 0-${MAX_LOOKUP_HISTORY_SLOTS} timeslots.`);
  }
  return knownSize;
}

/** https://graypaper.fluffylabs.dev/#/5f542d7/115400115800 */
export class LookupHistoryItem {
  constructor(
    public readonly hash: PreimageHash,
    public readonly length: U32,
    /**
     * Preimage availability history as a sequence of time slots.
     * See PreimageStatus and the following GP fragment for more details.
     * https://graypaper.fluffylabs.dev/#/5f542d7/11780011a500 */
    public slots: LookupHistorySlots,
  ) {}

  static isRequested(item: LookupHistoryItem): boolean {
    return item.slots.length === 0;
  }
}

/**
 * Service dictionary entry.
 */
export class Service extends WithDebug {
  constructor(
    /** Service id. */
    readonly id: ServiceId,
    /** Service details. */
    readonly data: {
      /** https://graypaper.fluffylabs.dev/#/85129da/383303383303?v=0.6.3 */
      info: ServiceAccountInfo;
      /** https://graypaper.fluffylabs.dev/#/85129da/10f90010f900?v=0.6.3 */
      preimages: HashDictionary<PreimageHash, PreimageItem>;
      /** https://graypaper.fluffylabs.dev/#/85129da/115400115800?v=0.6.3 */
      lookupHistory: HashDictionary<PreimageHash, LookupHistoryItem[]>;
      /** https://graypaper.fluffylabs.dev/#/85129da/10f80010f800?v=0.6.3 */
      storage: StateItem[];
    },
  ) {
    super();
  }
}
