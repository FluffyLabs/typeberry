import type { ServiceId, TimeSlot } from "@typeberry/block";
import type { PreimagesExtrinsic } from "@typeberry/block/preimage";
import { BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray, type HashDictionary } from "@typeberry/collections";
import { type Blake2bHash, blake2b } from "@typeberry/hash";
import type { U32 } from "@typeberry/numbers";
import { type Opaque, Result } from "@typeberry/utils";

export type PreimageHash = Opaque<Blake2bHash, "PreimageHash">;

export type Account = {
  id: ServiceId;
  data: {
    preimages: HashDictionary<PreimageHash, BytesBlob>;
    lookupHistory: LookupHistoryItem[]; // https://graypaper.fluffylabs.dev/#/5f542d7/115400115800
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

// docs: https://graypaper.fluffylabs.dev/#/5f542d7/116f00116f00
export enum PreimageStatus {
  Requested = 0,
  Available = 1,
  Unavailable = 2,
  Reavailable = 3,
}

const MAX_LOOKUP_HISTORY_SLOTS = 3;
export type LookupHistorySlotsSize = 0 | 1 | 2 | typeof MAX_LOOKUP_HISTORY_SLOTS;

// https://graypaper.fluffylabs.dev/#/5f542d7/115400115800
export class LookupHistoryItem {
  constructor(
    public readonly hash: PreimageHash,
    public readonly length: U32,
    public slots: FixedSizeArray<TimeSlot, LookupHistorySlotsSize>,
  ) {}

  // https://graypaper.fluffylabs.dev/#/5f542d7/116f0011a500
  public transitionSlots(slot: TimeSlot) {
    if (this.slots.length < MAX_LOOKUP_HISTORY_SLOTS) {
      this.slots = FixedSizeArray.new([...this.slots, slot], (this.slots.length + 1) as LookupHistorySlotsSize);
    } else {
      throw new Error("Illegal transition. Cannot add more than 3 slots to a lookup history item.");
    }
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
    let lastServiceId = -1;
    let lastBlob = BytesBlob.blobFrom(new Uint8Array());
    for (const preimage of input.preimages) {
      if (lastServiceId > preimage.requester) {
        return Result.error(PreimagesErrorCode.PreimagesNotSortedUnique);
      }
      if (lastServiceId === preimage.requester) {
        if (preimage.blob.isLessThan(lastBlob, { orEqual: true })) {
          // within the same service id, the blobs need to be ordered.
          return Result.error(PreimagesErrorCode.PreimagesNotSortedUnique);
        }
      }
      lastServiceId = preimage.requester;
      lastBlob = preimage.blob;
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
      if (!lookupHistoryItem || lookupHistoryItem.getStatus() === PreimageStatus.Available) {
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

    // https://graypaper.fluffylabs.dev/#/5f542d7/181300181300
    for (const change of pendingChanges) {
      const { account, hash, blob, lookupHistoryItem, slot } = change;
      account.data.preimages.set(hash, blob);
      lookupHistoryItem.transitionSlots(slot);
    }

    // TODO: [SeKo] consider if this is the right place to mark unavailable preimages in lookup history

    return Result.ok(null);
  }
}

export function getLookupHistoryItem(
  lookupHistory: LookupHistoryItem[],
  hash: PreimageHash,
  length: number,
): LookupHistoryItem | undefined {
  return lookupHistory.find((item) => item.hash.toString() === hash.toString() && item.length === length);
}
