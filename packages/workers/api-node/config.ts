import { type Decode, Decoder, type Encode, Encoder } from "@typeberry/codec";
import { ChainSpec } from "@typeberry/config";
import {
  type BlocksDb,
  InMemoryBlocks,
  InMemorySerializedStates,
  type RootDb,
  type SerializedStatesDb,
} from "@typeberry/database";
import { LmdbBlocks, LmdbRoot, LmdbStates } from "@typeberry/database-lmdb";
import { Blake2b } from "@typeberry/hash";
import type { WorkerConfig } from "@typeberry/workers-api";

/** A worker config that's usable in node.js and uses LMDB database backend. */
export class LmdbWorkerConfig<T = void> implements WorkerConfig<T, BlocksDb, SerializedStatesDb> {
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
    return new LmdbWorkerConfig(chainSpec, workerParams, dbPath, blake2b);
  }

  /** Restore node config from a transferable config object. */
  static async fromTransferable<T>(decodeParams: Decode<T>, config: TransferableConfig) {
    const blake2b = await Blake2b.createHasher();
    const chainSpec = new ChainSpec(config.chainSpec);
    const workerParams = Decoder.decodeObject(decodeParams, config.workerParams, chainSpec);

    return LmdbWorkerConfig.new({
      chainSpec,
      workerParams,
      dbPath: config.dbPath,
      blake2b,
    });
  }

  private constructor(
    public readonly chainSpec: ChainSpec,
    public readonly workerParams: T,
    public readonly dbPath: string,
    public readonly blake2b: Blake2b,
  ) {}

  openDatabase(options: { readonly: boolean } = { readonly: true }): RootDb<BlocksDb, SerializedStatesDb> {
    const lmdb = new LmdbRoot(this.dbPath, options.readonly);

    return {
      getBlocksDb: () => new LmdbBlocks(this.chainSpec, lmdb),
      getStatesDb: () => new LmdbStates(this.chainSpec, this.blake2b, lmdb),
      close: async () => await lmdb.close(),
    };
  }

  /** Convert this config into a thread-transferable object. */
  intoTransferable(paramsCodec: Encode<T>): TransferableConfig {
    return {
      chainSpec: this.chainSpec,
      workerParams: Encoder.encodeObject(paramsCodec, this.workerParams, this.chainSpec).raw,
      dbPath: this.dbPath,
    };
  }
}

/** Config that's safe to transfer between worker threads. */
export type TransferableConfig = {
  chainSpec: ChainSpec;
  workerParams: Uint8Array;
  dbPath: string;
};

/**
 * In-memory (direct) worker using serialized state database.
 *
 * Note the database is always empty, and needs to be initialized.
 */
export class InMemWorkerConfig<T = undefined> implements WorkerConfig<T, BlocksDb, SerializedStatesDb> {
  static new<T>({ chainSpec, workerParams, blake2b }: { chainSpec: ChainSpec; workerParams: T; blake2b: Blake2b }) {
    return new InMemWorkerConfig(chainSpec, workerParams, blake2b);
  }

  private readonly blocks: InMemoryBlocks;
  private readonly states: InMemorySerializedStates;

  private constructor(
    public readonly chainSpec: ChainSpec,
    public readonly workerParams: T,
    public readonly blake2b: Blake2b,
  ) {
    this.blocks = InMemoryBlocks.new();
    this.states = InMemorySerializedStates.withHasher({ chainSpec, blake2b });
  }

  openDatabase(_options: { readonly: boolean } = { readonly: true }): RootDb<BlocksDb, SerializedStatesDb> {
    // opening/closing db doesn't do anything, we persist the state.
    return {
      getBlocksDb: () => this.blocks,
      getStatesDb: () => this.states,
      close: async () => {},
    };
  }
}
