import type { HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import { StatisticsData } from "@typeberry/state";
import z from "zod";
import { type BlobArray, Hash, type RpcMethod } from "../types.js";

export const StatisticsParams = z.tuple([Hash]);
export type StatisticsParams = z.infer<typeof StatisticsParams>;

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
export const statistics: RpcMethod<StatisticsParams, [BlobArray] | null> = async ([headerHash], db, chainSpec) => {
  const hashOpaque: HeaderHash = Bytes.fromNumbers(headerHash, HASH_SIZE).asOpaque();
  const state = db.states.getState(hashOpaque);

  if (state === null) {
    return null;
  }

  return [Array.from(Encoder.encodeObject(StatisticsData.Codec, state.statistics, chainSpec).raw)];
};
