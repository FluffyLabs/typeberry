import type { ServiceId, TimeSlot } from "@typeberry/block";
import type { PreimagesExtrinsic } from "@typeberry/block/preimage";
import type { BytesBlob } from "@typeberry/bytes";
import type { HashDictionary } from "@typeberry/collections";
import { type Blake2bHash, blake2b } from "@typeberry/hash";
import { type Opaque, Result } from "@typeberry/utils";

export type PreimageHash = Opaque<Blake2bHash, "PreimageHash">;
export type AccountHistoryKey = string;

export type HistoryItem = {
  slots: TimeSlot[]; // indicates timeslots when the preimage was made available. if empty the preimage was requested but not yet provided
};

export type Account = {
  id: ServiceId;
  info: {
    preimages: HashDictionary<PreimageHash, BytesBlob>;
    history: Map<AccountHistoryKey, HistoryItem>; // https://graypaper.fluffylabs.dev/#/5f542d7/115400115800
  };
};

type AccountsState = {
  accounts: Map<ServiceId, Account>;
};

export type PreimagesInput = {
  preimages: PreimagesExtrinsic;
  slot: TimeSlot;
};

enum PreimagesErrorCode {
  PreimageUnneeded = "preimage_unneeded",
  AccountNotFound = "account_not_found",
  DuplicateLookup = "duplicate_lookup",
}

export class Preimages {
  constructor(public readonly state: AccountsState) {}

  integrate(input: PreimagesInput) {
    // make sure there are no duplicate lookups
    // "The lookup extrinsic is a sequence of pairs of service indices and data.
    // These pairs must be ordered and without duplicates."
    // https://graypaper.fluffylabs.dev/#/5f542d7/181700181700
    const seen = new Set<string>();
    for (const preimage of input.preimages) {
      const key = `${preimage.requester}-${preimage.blob}`;
      if (seen.has(key)) {
        return Result.error(PreimagesErrorCode.DuplicateLookup);
      }
      seen.add(key);
    }

    const { preimages, slot } = input;
    const pendingChanges: {
      account: Account;
      hash: PreimageHash;
      blob: BytesBlob;
      slot: TimeSlot;
    }[] = [];

    for (const preimage of preimages) {
      const { requester, blob } = preimage;
      const hash = blake2b.hashBytes(blob).asOpaque();
      const account = this.state.accounts.get(requester);

      if (!account) {
        return Result.error(PreimagesErrorCode.AccountNotFound);
      }

      if (!this.isNeeded(hash, blob.length, account)) {
        return Result.error(PreimagesErrorCode.PreimageUnneeded);
      }

      pendingChanges.push({
        account,
        hash,
        blob,
        slot,
      });
    }

    for (const change of pendingChanges) {
      const { account, hash, blob, slot } = change;
      account.info.preimages.set(hash, blob);
      account.info.history.get(historyKey(hash, blob.length))?.slots.push(slot);
    }

    return Result.ok(null);
  }

  // Make sure the preimage has been explicitly requested by the account but not yet integrated
  // "The data must have been solicited by a service but not yet provided in the prior state."
  // https://graypaper.fluffylabs.dev/#/5f542d7/181800181900
  private isNeeded(hash: PreimageHash, length: number, account: Account) {
    // make sure requested
    if (!account.info.history.has(historyKey(hash, length))) {
      return false;
    }

    // make sure not integrated
    if (account.info.preimages.has(hash)) {
      return false;
    }

    return true;
  }
}

export function historyKey(hash: PreimageHash, length: number): AccountHistoryKey {
  return `${hash}-${length}`;
}
