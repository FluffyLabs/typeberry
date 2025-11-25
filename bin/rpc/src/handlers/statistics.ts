import type { HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import { StatisticsData } from "@typeberry/state";
import { type Handler, RpcError, RpcErrorCode } from "../types.js";

export const statistics: Handler<"statistics"> = async ([headerHash], { db, chainSpec }) => {
  const hashOpaque: HeaderHash = Bytes.fromBlob(headerHash, HASH_SIZE).asOpaque();
  const state = db.states.getState(hashOpaque);

  if (state === null) {
    throw new RpcError(RpcErrorCode.Other, `State not found for block: ${hashOpaque.toString()}`);
  }

  return Encoder.encodeObject(StatisticsData.Codec, state.statistics, chainSpec).raw;
};
