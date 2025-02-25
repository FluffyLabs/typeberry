import type { ServiceId, TimeSlot } from "@typeberry/block";
import type { PreimageHash, PreimagesExtrinsic } from "@typeberry/block/preimage";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import { type HashDictionary, type KnownSizeArray, asKnownSize } from "@typeberry/collections";
import { HASH_SIZE, blake2b } from "@typeberry/hash";
import type { U32 } from "@typeberry/numbers";
import { Result } from "@typeberry/utils";

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

  public isRequested(): boolean {
    return this.slots.length === 0;
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
      if (account.data.preimages.has(hash) || !lookupHistoryItem || !lookupHistoryItem.isRequested()) {
        return Result.error(PreimagesErrorCode.PreimageUnneeded);
      }

      pendingChanges.push({
        account,
        hash,
        blob,
        lookupHistoryItem,
      });
    }

    // https://graypaper.fluffylabs.dev/#/5f542d7/18c00018f300
    for (const change of pendingChanges) {
      const { account, hash, blob, lookupHistoryItem } = change;
      account.data.preimages.set(hash, blob);
      lookupHistoryItem.slots = tryAsLookupHistorySlots([slot]);
    }

    return Result.ok(null);
  }
}

export function getLookupHistoryItem(
  lookupHistory: LookupHistoryItem[],
  hash: PreimageHash,
  length: number,
): LookupHistoryItem | undefined {
  // TODO [ToDr] [opti] avoid linear lookup. Most likely we should decode state into a dictionary here.
  return lookupHistory.find((item) => item.hash.isEqualTo(hash) && item.length === length);
}
