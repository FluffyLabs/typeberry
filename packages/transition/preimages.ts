import type { ServiceId, TimeSlot } from "@typeberry/block";
import type { Preimage, PreimagesExtrinsic } from "@typeberry/block/preimage";
import type { BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { type Blake2bHash, blake2b } from "@typeberry/hash";
import { Result, type Opaque } from "@typeberry/utils";

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

export type PreimagesInput = {
  preimages: PreimagesExtrinsic;
  slot: TimeSlot;
};

enum PreimagesErrorCode {
  PreimageUnneeded = "preimage_unneeded",
}

export class Preimages {
  constructor(public readonly state: AccountsState) {}

  integrate(input: PreimagesInput) {
    const { preimages, slot } = input;
    let err: PreimagesErrorCode | null = null;

    for (const preimage of preimages) {
      const { requester, blob } = preimage;
      const hash = blake2b.hashBytes(blob).asOpaque();

      if (!this.isNeeded(hash)) {
        err = PreimagesErrorCode.PreimageUnneeded;
        continue;
      }

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

    return err ? Result.error(err) : Result.ok(null);
  }

  private isNeeded(hash: PreimageHash) {
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
