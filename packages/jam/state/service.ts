import {
  type CodeHash,
  type ServiceGas,
  type ServiceId,
  type TimeSlot,
  tryAsServiceGas,
  tryAsServiceId,
  tryAsTimeSlot,
} from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, Descriptor, type SizeHint, codec } from "@typeberry/codec";
import { type KnownSizeArray, asKnownSize } from "@typeberry/collections";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { type U32, type U64, tryAsU64 } from "@typeberry/numbers";
import { Compatibility, GpVersion, type Opaque, WithDebug, check } from "@typeberry/utils";

/**
 * `B_S`: The basic minimum balance which all services require.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/445800445800?v=0.6.7
 */
export const BASE_SERVICE_BALANCE = 100n;
/**
 * `B_I`: The additional minimum balance required per item of elective service state.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/445000445000?v=0.6.7
 */
export const ELECTIVE_ITEM_BALANCE = 10n;
/**
 * `B_L`: The additional minimum balance required per octet of elective service state.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/445400445400?v=0.6.7
 */
export const ELECTIVE_BYTE_BALANCE = 1n;

const zeroSizeHint: SizeHint = {
  bytes: 0,
  isExact: true,
};

/** 0-byte read, return given default value */
export const ignoreValueWithDefault = <T>(defaultValue: T) =>
  Descriptor.new<T>(
    "ignoreValue",
    zeroSizeHint,
    (_e, _v) => {},
    (_d) => defaultValue,
    (_s) => {},
  );

/**
 * Service account details.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/108301108301?v=0.6.7
 */
export class ServiceAccountInfo extends WithDebug {
  static Codec = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
    ? codec.Class(ServiceAccountInfo, {
        codeHash: codec.bytes(HASH_SIZE).asOpaque<CodeHash>(),
        balance: codec.u64,
        accumulateMinGas: codec.u64.convert((x) => x, tryAsServiceGas),
        onTransferMinGas: codec.u64.convert((x) => x, tryAsServiceGas),
        storageUtilisationBytes: codec.u64,
        gratisStorage: codec.u64,
        storageUtilisationCount: codec.u32,
        created: codec.u32.convert((x) => x, tryAsTimeSlot),
        lastAccumulation: codec.u32.convert((x) => x, tryAsTimeSlot),
        parentService: codec.u32.convert((x) => x, tryAsServiceId),
      })
    : codec.Class(ServiceAccountInfo, {
        codeHash: codec.bytes(HASH_SIZE).asOpaque<CodeHash>(),
        balance: codec.u64,
        accumulateMinGas: codec.u64.convert((x) => x, tryAsServiceGas),
        onTransferMinGas: codec.u64.convert((x) => x, tryAsServiceGas),
        storageUtilisationBytes: codec.u64,
        storageUtilisationCount: codec.u32,
        gratisStorage: ignoreValueWithDefault(tryAsU64(0)),
        created: ignoreValueWithDefault(tryAsTimeSlot(0)),
        lastAccumulation: ignoreValueWithDefault(tryAsTimeSlot(0)),
        parentService: ignoreValueWithDefault(tryAsServiceId(0)),
      });

  static create(a: CodecRecord<ServiceAccountInfo>) {
    return new ServiceAccountInfo(
      a.codeHash,
      a.balance,
      a.accumulateMinGas,
      a.onTransferMinGas,
      a.storageUtilisationBytes,
      a.gratisStorage,
      a.storageUtilisationCount,
      a.created,
      a.lastAccumulation,
      a.parentService,
    );
  }

  /**
   * `a_t = max(0, BS + BI * a_i + BL * a_o - a_f)`
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/119e01119e01?v=0.6.7
   */
  static calculateThresholdBalance(items: U32, bytes: U64, gratisStorage: U64): U64 {
    check(
      gratisStorage === tryAsU64(0) || Compatibility.isGreaterOrEqual(GpVersion.V0_6_7),
      "Gratis storage cannot be non-zero before 0.6.7",
    );

    const storageCost =
      BASE_SERVICE_BALANCE + ELECTIVE_ITEM_BALANCE * BigInt(items) + ELECTIVE_BYTE_BALANCE * bytes - gratisStorage;

    if (storageCost < 0n) {
      return tryAsU64(0);
    }

    if (storageCost >= 2n ** 64n) {
      return tryAsU64(2n ** 64n - 1n);
    }

    return tryAsU64(storageCost);
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
    /** `a_f`: Cost-free storage. Decreases both storage item count and total byte size. */
    public readonly gratisStorage: U64,
    /** `a_i`: Number of items in storage. */
    public readonly storageUtilisationCount: U32,
    /** `a_r`: Creation account time slot. */
    public readonly created: TimeSlot,
    /** `a_a`: Most recent accumulation time slot. */
    public readonly lastAccumulation: TimeSlot,
    /** `a_p`: Parent service ID. */
    public readonly parentService: ServiceId,
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

export type StorageKey = Opaque<OpaqueHash, "stateKey">;

export class StorageItem extends WithDebug {
  static Codec = codec.Class(StorageItem, {
    key: codec.bytes(HASH_SIZE).asOpaque<StorageKey>(),
    value: codec.blob,
  });

  static create({ key, value }: CodecRecord<StorageItem>) {
    return new StorageItem(key, value);
  }

  private constructor(
    readonly key: StorageKey,
    readonly value: BytesBlob,
  ) {
    super();
  }
}

const MAX_LOOKUP_HISTORY_SLOTS = 3;
export type LookupHistorySlots = KnownSizeArray<TimeSlot, `0-${typeof MAX_LOOKUP_HISTORY_SLOTS} timeslots`>;
export function tryAsLookupHistorySlots(items: readonly TimeSlot[]): LookupHistorySlots {
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
    public readonly slots: LookupHistorySlots,
  ) {}

  static isRequested(item: LookupHistoryItem | LookupHistorySlots): boolean {
    if ("slots" in item) {
      return item.slots.length === 0;
    }
    return item.length === 0;
  }
}
