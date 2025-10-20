import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb, InMemoryBlocks, InMemoryStates, RootDb, StatesDb } from "@typeberry/database";

/** Standardized worker config. */
export interface WorkerConfig<TParams = void, TBlocks = BlocksDb, TStates = StatesDb> {
  /** Chain spec. */
  readonly chainSpec: ChainSpec;
  /** Worker parameters. */
  readonly workerParams: TParams;

  /** Open database. */
  openDatabase(options?: { readonly: boolean }): RootDb<TBlocks, TStates>;
}

/**
 * Worker config with in-thread database.
 */
export class DirectWorkerConfig<TParams = void, TBlocks = BlocksDb, TStates = StatesDb>
  implements WorkerConfig<TParams, TBlocks, TStates>
{
  static new<T>({
    chainSpec,
    blocksDb,
    statesDb,
    params,
  }: {
    chainSpec: ChainSpec;
    blocksDb: InMemoryBlocks;
    statesDb: InMemoryStates;
    params: T;
  }): DirectWorkerConfig<T> {
    return new DirectWorkerConfig(chainSpec, params, blocksDb, statesDb);
  }

  private constructor(
    public readonly chainSpec: ChainSpec,
    public readonly workerParams: TParams,
    private readonly blocksDb: TBlocks,
    private readonly statesDb: TStates,
  ) {}

  openDatabase(_options?: { readonly: boolean }): RootDb<TBlocks, TStates> {
    return {
      getBlocksDb: () => this.blocksDb,
      getStatesDb: () => this.statesDb,
      close: () => Promise.resolve(),
    };
  }
}
