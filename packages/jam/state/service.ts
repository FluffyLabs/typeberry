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
import { type CodecRecord, codec } from "@typeberry/codec";
import { type KnownSizeArray, asKnownSize } from "@typeberry/collections";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { type U32, type U64, sumU64, tryAsU64 } from "@typeberry/numbers";
import { type Opaque, WithDebug } from "@typeberry/utils";
import { Compatibility, GpVersion } from "@typeberry/utils/compatibility.js";

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

type ServiceAccountInfoBase = {
  codeHash: CodeHash;
  balance: U64;
  accumulateMinGas: ServiceGas;
  onTransferMinGas: ServiceGas;
  storageUtilisationBytes: U64;
  storageUtilisationCount: U32;
};

// >= 0.6.7
type ServiceAccountInfoExtended = ServiceAccountInfoBase & {
  gratisStorage?: U64;
  created?: TimeSlot;
  lastAccumulation?: TimeSlot;
  parentService?: ServiceId;
};

/**
 * Service account details.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/108301108301?v=0.6.7
 */
export class ServiceAccountInfo extends WithDebug {
  static Codec067 = codec.Class(ServiceAccountInfo, {
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
  });

  static CodecLegacy = codec.Class(ServiceAccountInfo, {
    codeHash: codec.bytes(HASH_SIZE).asOpaque<CodeHash>(),
    balance: codec.u64,
    accumulateMinGas: codec.u64.convert((x) => x, tryAsServiceGas),
    onTransferMinGas: codec.u64.convert((x) => x, tryAsServiceGas),
    storageUtilisationBytes: codec.u64,
    gratisStorage: codec.noopBig.convert((_) => 0n, tryAsU64),
    storageUtilisationCount: codec.u32,
    created: codec.noop.convert((_) => 0, tryAsTimeSlot),
    lastAccumulation: codec.noop.convert((_) => 0, tryAsTimeSlot),
    parentService: codec.noop.convert((_) => 0, tryAsServiceId),
  });

  static get Codec() {
    if (Compatibility.is(GpVersion.V0_6_7)) {
      return ServiceAccountInfo.Codec067;
    }
    return ServiceAccountInfo.CodecLegacy;
  }

  static create(a: ServiceAccountInfoExtended) {
    return new ServiceAccountInfo(
      a.codeHash,
      a.balance,
      a.accumulateMinGas,
      a.onTransferMinGas,
      a.storageUtilisationBytes,
      a.gratisStorage ?? tryAsU64(0),
      a.storageUtilisationCount,
      a.created ?? tryAsTimeSlot(0),
      a.lastAccumulation ?? tryAsTimeSlot(0),
      a.parentService ?? tryAsServiceId(0),
    );
  }

  /**
   * `a_t = BS + BI * a_i + BL * a_o`
   * https://graypaper.fluffylabs.dev/#/9a08063/117201117201?v=0.6.6
   */
  static calculateThresholdBalance(items: U32, bytes: U64): U64 {
    const sum = sumU64(
      tryAsU64(BASE_SERVICE_BALANCE),
      tryAsU64(ELECTIVE_ITEM_BALANCE * BigInt(items)),
      tryAsU64(ELECTIVE_BYTE_BALANCE * bytes),
    );
    if (sum.overflow) {
      return tryAsU64(2n ** 64n - 1n);
    }
    return sum.value;
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
    /** `a_f`: Gratis storage offset. */
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
    hash: codec.bytes(HASH_SIZE).asOpaque<StorageKey>(),
    blob: codec.blob,
  });

  static create({ hash, blob }: CodecRecord<StorageItem>) {
    return new StorageItem(hash, blob);
  }

  private constructor(
    readonly hash: StorageKey,
    readonly blob: BytesBlob,
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
