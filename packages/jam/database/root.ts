import type { BlocksDb } from "./blocks.js";
import type { StatesDb } from "./states.js";

/** Root database. */
export interface RootDb<TBlocks = BlocksDb, TStates = StatesDb> {
  /** Blocks DB. */
  getBlocksDb(): TBlocks;

  /** States DB. */
  getStatesDb(): TStates;

  /** Close access to the DB. */
  close(): Promise<void>;
}
