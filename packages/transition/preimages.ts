import type { ServiceId, TimeSlot } from "@typeberry/block";
import type { PreimagesExtrinsic } from "@typeberry/block/preimage";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import { type HashDictionary, type KnownSizeArray, asKnownSize } from "@typeberry/collections";
import { type Blake2bHash, HASH_SIZE, blake2b } from "@typeberry/hash";
import type { U32 } from "@typeberry/numbers";
import { type Opaque, Result } from "@typeberry/utils";

export type PreimageHash = Opaque<Blake2bHash, "PreimageHash">;

export type Account = {
  id: ServiceId;
  data: {
    preimages: HashDictionary<PreimageHash, BytesBlob>;
    /** https://graypaper.fluffylabs.dev/#/5f542d7/115400115800 */
    lookupHistory: LookupHistoryItem[];
  };
};

type AccountsState = {
  accounts: Map<ServiceId, Account>;
};

export type PreimagesInput = {
  preimages: PreimagesExtrinsic;
  slot: TimeSlot;
};

export enum PreimagesErrorCode {
  PreimageUnneeded = "preimage_unneeded",
  PreimagesNotSortedUnique = "preimages_not_sorted_unique",
  AccountNotFound = "account_not_found",
}

/**
 * Preimage status is determined by the number of timeslots in a lookup history
 * item, where each timeslot describes when the particular status was achieved.
 * Status transitions can only happen one step at a time in the following order:
 * Requested (denoted by empty array) -> Available -> Unavailable -> Reavailable
 * docs: https://graypaper.fluffylabs.dev/#/5f542d7/116f00116f00 */
export enum PreimageStatus {
  Requested = 0,
  Available = 1,
  Unavailable = 2,
  Reavailable = 3,
}

const MAX_LOOKUP_HISTORY_SLOTS = 3;
export type LookupHistorySlots = KnownSizeArray<TimeSlot, "0-3 timeslots">;
export function tryAsLookupHistorySlots(items: TimeSlot[]): LookupHistorySlots {
  const knownSize = asKnownSize(items) as LookupHistorySlots;
  if (knownSize.length > MAX_LOOKUP_HISTORY_SLOTS) {
    throw new Error("Lookup history items must contain 0-3 timeslots.");
  }
  return knownSize;
}

/** https://graypaper.fluffylabs.dev/#/5f542d7/115400115800 */
export class LookupHistoryItem {
  static Codec = codec.Class(LookupHistoryItem, {
    hash: codec.bytes(HASH_SIZE).asOpaque(),
    length: codec.u32,
    slots: codec.sequenceVarLen(codec.u32).convert(
      (x) => x,
      (items) => tryAsLookupHistorySlots(items as TimeSlot[]),
    ),
  });

  static fromCodec({ hash, length, slots }: CodecRecord<LookupHistoryItem>) {
    return new LookupHistoryItem(hash, length, slots);
  }

  constructor(
    public readonly hash: PreimageHash,
    public readonly length: U32,
    /**
     * Preimage availability history as a sequence of time slots.
     * See PreimageStatus and the following GP fragment for more details.
     * https://graypaper.fluffylabs.dev/#/5f542d7/11780011a500 */
    public slots: LookupHistorySlots,
  ) {}

  // https://graypaper.fluffylabs.dev/#/5f542d7/116f0011a500
  public setAvailable(slot: TimeSlot) {
    if (this.slots.length > 0) {
      throw new Error('Illegal transition: To set preimage state to "available", it must be "requested" first.');
    }

    this.slots = tryAsLookupHistorySlots([slot]);
  }

  public setUnavailable(slot: TimeSlot) {
    if (this.slots.length !== 1) {
      throw new Error('Illegal transition: To set preimage state to "unavailable", it must be "available" first.');
    }

    this.slots = tryAsLookupHistorySlots([this.slots[0], slot]);
  }

  public setReavailable(slot: TimeSlot) {
    if (this.slots.length !== 2) {
      throw new Error('Illegal transition: To set preimage state to "re-available", it must be "unavailable" first.');
    }

    this.slots = tryAsLookupHistorySlots([this.slots[0], this.slots[1], slot]);
  }

  public getStatus(): PreimageStatus {
    return this.slots.length; // it's only a coincidence that enum values correspond to length but taking advantage of it
  }
}

// TODO [SeKo] consider whether this module is the right place to remove expired preimages
export class Preimages {
  constructor(public readonly state: AccountsState) {}

  integrate(input: PreimagesInput) {
    // make sure lookup extrinsics are sorted and unique
    // "The lookup extrinsic is a sequence of pairs of service indices and data.
    // These pairs must be ordered and without duplicates."
    // https://graypaper.fluffylabs.dev/#/5f542d7/181700181700
    for (let i = 1; i < input.preimages.length; i++) {
      const prevPreimage = input.preimages[i - 1];
      const currPreimage = input.preimages[i];

      if (prevPreimage.requester < currPreimage.requester) {
        continue;
      }

      if (prevPreimage.requester > currPreimage.requester || currPreimage.blob.isLessThanOrEqualTo(prevPreimage.blob)) {
        return Result.error(PreimagesErrorCode.PreimagesNotSortedUnique);
      }
    }

    const { preimages, slot } = input;
    const pendingChanges: {
      account: Account;
      hash: PreimageHash;
      blob: BytesBlob;
      lookupHistoryItem: LookupHistoryItem;
      slot: TimeSlot;
    }[] = [];

    // select preimages for integration
    for (const preimage of preimages) {
      const { requester, blob } = preimage;
      const hash = blake2b.hashBytes(blob).asOpaque();
      const account = this.state.accounts.get(requester);

      if (!account) {
        return Result.error(PreimagesErrorCode.AccountNotFound);
      }

      const lookupHistoryItem = getLookupHistoryItem(account.data.lookupHistory, hash, blob.length);

      // https://graypaper.fluffylabs.dev/#/5f542d7/181800181900
      // https://graypaper.fluffylabs.dev/#/5f542d7/116f0011a500
      if (
        account.data.preimages.has(hash) ||
        !lookupHistoryItem ||
        lookupHistoryItem.getStatus() !== PreimageStatus.Requested
      ) {
        return Result.error(PreimagesErrorCode.PreimageUnneeded);
      }

      pendingChanges.push({
        account,
        hash,
        blob,
        lookupHistoryItem,
        slot,
      });
    }

    // https://graypaper.fluffylabs.dev/#/5f542d7/18c00018f300
    for (const change of pendingChanges) {
      const { account, hash, blob, lookupHistoryItem, slot } = change;
      account.data.preimages.set(hash, blob);
      lookupHistoryItem.setAvailable(slot);
    }

    return Result.ok(null);
  }
}

export function getLookupHistoryItem(
  lookupHistory: LookupHistoryItem[],
  hash: PreimageHash,
  length: number,
): LookupHistoryItem | undefined {
  return lookupHistory.find((item) => item.hash.isEqualTo(hash) && item.length === length);
}
