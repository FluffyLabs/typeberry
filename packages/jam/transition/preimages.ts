import type { TimeSlot } from "@typeberry/block";
import type { PreimageHash, PreimagesExtrinsic } from "@typeberry/block/preimage";
import { blake2b } from "@typeberry/hash";
import { LookupHistoryItem, PreimageItem, type ServicesUpdate, type State, UpdatePreimage } from "@typeberry/state";
import { Result } from "@typeberry/utils";

export type PreimagesState = Pick<State, "service">;

export type PreimagesStateUpdate = Pick<ServicesUpdate, "preimages">;

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

  integrate(input: PreimagesInput): Result<PreimagesStateUpdate, PreimagesErrorCode> {
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
    const pendingChanges: UpdatePreimage[] = [];

    // select preimages for integration
    for (const preimage of preimages) {
      const { requester, blob } = preimage;
      const hash: PreimageHash = blake2b.hashBytes(blob).asOpaque();

      const service = this.state.service(requester);
      if (service === null) {
        return Result.error(PreimagesErrorCode.AccountNotFound);
      }

      const preimageHistory = service.lookupHistory(hash);
      const lookupHistoryItem = preimageHistory?.find(
        (item) => item.hash.isEqualTo(hash) && item.length === blob.length,
      );

      const hasPreimage = service.hasPreimage(hash);
      // https://graypaper.fluffylabs.dev/#/5f542d7/181800181900
      // https://graypaper.fluffylabs.dev/#/5f542d7/116f0011a500
      if (hasPreimage || lookupHistoryItem === undefined || !LookupHistoryItem.isRequested(lookupHistoryItem)) {
        return Result.error(PreimagesErrorCode.PreimageUnneeded);
      }

      // https://graypaper.fluffylabs.dev/#/5f542d7/18c00018f300
      pendingChanges.push(
        UpdatePreimage.provide({
          serviceId: requester,
          preimage: PreimageItem.create({ hash, blob }),
          slot,
        }),
      );
    }

    return Result.ok({
      preimages: pendingChanges,
    });
  }
}
