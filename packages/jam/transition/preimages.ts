import type { TimeSlot } from "@typeberry/block";
import type { PreimageHash, PreimagesExtrinsic } from "@typeberry/block/preimage";
import { blake2b } from "@typeberry/hash";
import {
  LookupHistoryItem,
  PreimageItem,
  PreimageUpdate,
  type ServicesUpdate,
  type State,
  StateUpdate,
} from "@typeberry/state";
import { Result } from "@typeberry/utils";

type PreimagesState = Pick<State, "services">;

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
  constructor(public readonly state: PreimagesState) {}

  integrate(input: PreimagesInput): Result<StateUpdate<ServicesUpdate>, PreimagesErrorCode> {
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
    const pendingChanges: PreimageUpdate[] = [];

    // select preimages for integration
    for (const preimage of preimages) {
      const { requester, blob } = preimage;
      const hash: PreimageHash = blake2b.hashBytes(blob).asOpaque();
      const account = this.state.services.get(requester);

      if (account === undefined) {
        return Result.error(PreimagesErrorCode.AccountNotFound);
      }

      const preimageHistory = account.data.lookupHistory.get(hash);
      const lookupHistoryItem = preimageHistory?.find(
        (item) => item.hash.isEqualTo(hash) && item.length === blob.length,
      );

      // https://graypaper.fluffylabs.dev/#/5f542d7/181800181900
      // https://graypaper.fluffylabs.dev/#/5f542d7/116f0011a500
      if (
        account.data.preimages.has(hash) ||
        lookupHistoryItem === undefined ||
        !LookupHistoryItem.isRequested(lookupHistoryItem)
      ) {
        return Result.error(PreimagesErrorCode.PreimageUnneeded);
      }

      // https://graypaper.fluffylabs.dev/#/5f542d7/18c00018f300
      pendingChanges.push(
        PreimageUpdate.provide({
          serviceId: requester,
          preimage: PreimageItem.create({ hash, blob }),
          slot,
        }),
      );
    }

    return Result.ok(
      StateUpdate.new({
        preimages: pendingChanges,
      }),
    );
  }
}
