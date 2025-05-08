import type { Hash, RpcMethod, Slot } from "../types";

export const bestBlock: RpcMethod = async (_params, db): Promise<[Hash, Slot]> => {
  const [headerHash, stateRootHash] = db.blocks.getBestData();
  const header = db.blocks.getHeader(headerHash);
  if (!header) {
    throw new Error(`Best header not found with hash: ${headerHash.raw}`);
  }

  const state = db.states.getFullState(stateRootHash);
  if (state === null) {
    throw new Error(`Unable to load best state from hash: ${stateRootHash}.`);
  }

  return [Array.from(headerHash.raw), state.timeslot];
};
