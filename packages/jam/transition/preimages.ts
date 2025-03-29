import type { ServiceId, TimeSlot } from "@typeberry/block";
import type { PreimageHash, PreimagesExtrinsic } from "@typeberry/block/preimage";
import type { BytesBlob } from "@typeberry/bytes";
import type { HashDictionary } from "@typeberry/collections";
import { blake2b } from "@typeberry/hash";
import { type LookupHistoryItem, tryAsLookupHistorySlots } from "@typeberry/state";
import { Result } from "@typeberry/utils";

export type Account = {
  id: ServiceId;
  data: {
    preimages: HashDictionary<PreimageHash, BytesBlob>;
    /** https://graypaper.fluffylabs.dev/#/5f542d7/115400115800 */
    lookupHistory: HashDictionary<PreimageHash, LookupHistoryItem[]>;
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

      if (
        prevPreimage.requester > currPreimage.requester ||
        currPreimage.blob.compare(prevPreimage.blob).isLessOrEqual()
      ) {
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

      if (account === undefined) {
        return Result.error(PreimagesErrorCode.AccountNotFound);
      }

      const preimageHistory = account.data.lookupHistory.get(hash);
      const lookupHistoryItem = getLookupHistoryItem(preimageHistory, hash, blob.length);

      // https://graypaper.fluffylabs.dev/#/5f542d7/181800181900
      // https://graypaper.fluffylabs.dev/#/5f542d7/116f0011a500
      if (account.data.preimages.has(hash) || lookupHistoryItem === undefined || !lookupHistoryItem?.isRequested()) {
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
  lookupHistory: LookupHistoryItem[] | undefined,
  hash: PreimageHash,
  length: number,
): LookupHistoryItem | undefined {
  return lookupHistory?.find((item) => item.hash.isEqualTo(hash) && item.length === length);
}
