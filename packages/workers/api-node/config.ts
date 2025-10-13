import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb, LeafDb, StatesDb } from "@typeberry/database";
import { LmdbBlocks, LmdbRoot, LmdbStates } from "@typeberry/database-lmdb";
import type { Blake2b } from "@typeberry/hash";
import type { SerializedState } from "@typeberry/state-merkleization";
import type { DatabaseAccess, WorkerConfig } from "@typeberry/workers-api";

/**
 * A worker config that's usable in node.js and uses LMDB database backend.
 */
export class NodeConfig<T = undefined> implements WorkerConfig<T, BlocksDb, StatesDb<SerializedState<LeafDb>>> {
  static new<T>({
    chainSpec,
    workerParams,
    dbPath,
    blake2b,
  }: {
    chainSpec: ChainSpec;
    workerParams: T;
    dbPath: string;
    blake2b: Blake2b;
  }) {
    return new NodeConfig(chainSpec, workerParams, dbPath, blake2b);
  }

  private constructor(
    public readonly chainSpec: ChainSpec,
    public readonly workerParams: T,
    public readonly dbPath: string,
    public readonly blake2b: Blake2b,
  ) {}

  openDatabase(
    options: { readonly: boolean } = { readonly: true },
  ): DatabaseAccess<BlocksDb, StatesDb<SerializedState<LeafDb>>> {
    const lmdb = new LmdbRoot(this.dbPath, options.readonly);

    return {
      getBlocksDb: () => new LmdbBlocks(this.chainSpec, lmdb),
      getStatesDb: () => new LmdbStates(this.chainSpec, this.blake2b, lmdb),
      close: () => lmdb.close(),
    };
  }
}
