import type { ServiceId, TimeSlot } from "@typeberry/block";
import type { Preimage, PreimagesExtrinsic } from "@typeberry/block/preimage";
import type { BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { type Blake2bHash, blake2b } from "@typeberry/hash";
import type { Opaque } from "@typeberry/utils";

export type PreimageHash = Opaque<Blake2bHash, "PreimageHash">;

export type HistoryItem = {
  hash: PreimageHash;
  length: number;
  slots: TimeSlot[];
};

export type Account = {
  id: ServiceId;
  info: {
    preimages: HashDictionary<PreimageHash, BytesBlob>;
    history: HistoryItem[];
  };
};

type AccountsState = {
  accounts: Map<ServiceId, Account>;
};

export type LookupExtrinsic = {
  preimages: PreimagesExtrinsic;
  slot: TimeSlot;
};

enum PreimagesErrorCode {
  PreimageUnneeded = "preimage_unneeded",
}

export class Preimages {
  constructor(public readonly state: AccountsState) {}

  integrate(lookup: LookupExtrinsic) {
    const { preimages, slot } = lookup;
    let err: PreimagesErrorCode | null = null;

    for (const preimage of preimages) {
      const { requester, blob } = preimage;

      if (!this.isNeeded(preimage)) {
        err = PreimagesErrorCode.PreimageUnneeded;
        continue;
      }

      const hash = blake2b.hashBytes(blob).asOpaque();
      let account = this.state.accounts.get(requester);

      // create account if it doesn't exist
      if (!account) {
        const newAccount = {
          id: requester,
          info: {
            preimages: new HashDictionary<PreimageHash, BytesBlob>(),
            history: [],
          },
        };
        this.state.accounts.set(requester, newAccount);
        account = newAccount;
      }

      // add preimage to the account
      account.info.preimages.set(blake2b.hashBytes(blob).asOpaque(), blob);

      // update history
      const existingHistoryItem = account.info.history.find((item) => item.hash.isEqualTo(hash));
      if (existingHistoryItem) {
        existingHistoryItem.slots.push(slot);
      } else {
        account.info.history.push({
          hash,
          length: blob.length,
          slots: [slot],
        });
      }
    }

    return err ? { err } : { ok: null };
  }

  private isNeeded(preimage: Preimage) {
    const hash = blake2b.hashBytes(preimage.blob).asOpaque();

    // check for duplicates
    for (const [_, account] of this.state.accounts) {
      if (account.info.preimages.has(hash)) {
        return false;
      }
    }

    // TODO [SeKo] check for other cases of preimage unneeded

    return true;
  }
}
