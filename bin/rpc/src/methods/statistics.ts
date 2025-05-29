import type { HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import { StatisticsData } from "@typeberry/state";
import type { BlobArray, Hash, RpcMethod } from "../types";

/**
 * https://hackmd.io/@polkadot/jip2#statistics
 * Returns the activity statistics stored in the posterior state of the block with the given header hash.
 * The statistics are encoded as per the GP. `null` is returned if the block's posterior state is not
 * known.
 * @param [
 *   Hash - The header hash indicating the block whose posterior state should be used for the query.
 * ]
 * @returns Blob
 */
export const statistics: RpcMethod<[Hash], [BlobArray] | null> = async ([headerHash], db, chainSpec) => {
  const hashOpaque: HeaderHash = Bytes.fromNumbers(headerHash, HASH_SIZE).asOpaque();
  const stateRoot = db.blocks.getPostStateRoot(hashOpaque);

  if (stateRoot === null) {
    return null;
  }

  const state = db.states.getFullState(stateRoot);

  if (state === null) {
    return null;
  }

  return [Array.from(Encoder.encodeObject(StatisticsData.Codec, state.statistics, chainSpec).raw)];
};
