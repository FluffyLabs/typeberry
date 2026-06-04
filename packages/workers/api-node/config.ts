import type { MessagePort } from "node:worker_threads";
import { type Decode, Decoder, type Encode, Encoder } from "@typeberry/codec";
import { ChainSpec } from "@typeberry/config";
import {
  type BlocksDb,
  InMemoryBlocks,
  InMemorySerializedStates,
  type RootDb,
  type SerializedStatesDb,
} from "@typeberry/database";
import { HybridSerializedStates as FjallHybridSerializedStates } from "@typeberry/database-fjall";
import {
  LmdbBlocks,
  HybridSerializedStates as LmdbHybridSerializedStates,
  LmdbRoot,
  LmdbStates,
} from "@typeberry/database-lmdb";
import { Blake2b } from "@typeberry/hash";
import type { WorkerConfig } from "@typeberry/workers-api";
import { ThreadPort, type TransferablePort } from "./port.js";

/** A worker config that's usable in node.js and uses LMDB database backend. */
export class LmdbWorkerConfig<T = void> implements WorkerConfig<T, BlocksDb, SerializedStatesDb> {
  static new<T>({
    nodeName,
    chainSpec,
    workerParams,
    dbPath,
    blake2b,
    ports = new Map(),
    ephemeral = false,
  }: {
    nodeName: string;
    chainSpec: ChainSpec;
    workerParams: T;
    dbPath: string;
    blake2b: Blake2b;
    ports?: Map<string, ThreadPort>;
    ephemeral?: boolean;
  }) {
    return new LmdbWorkerConfig(nodeName, chainSpec, workerParams, dbPath, blake2b, ports, ephemeral);
  }

  /** Restore node config from a transferable config object. */
  static async fromTransferable<T>(decodeParams: Decode<T>, config: TransferableConfig) {
    const blake2b = await Blake2b.createHasher();
    const chainSpec = ChainSpec.new(config.chainSpec);
    const workerParams = Decoder.decodeObject(decodeParams, config.workerParams, chainSpec);
    const ports = new Map(
      config.workerPorts.map(([name, port]) => [name, ThreadPort.fromTransferable(chainSpec, port)]),
    );

    return LmdbWorkerConfig.new({
      nodeName: config.nodeName,
      chainSpec,
      workerParams,
      dbPath: config.dbPath,
      blake2b,
      ports,
    });
  }

  private constructor(
    public readonly nodeName: string,
    public readonly chainSpec: ChainSpec,
    public readonly workerParams: T,
    public readonly dbPath: string,
    public readonly blake2b: Blake2b,
    public readonly ports: Map<string, ThreadPort>,
    // When set, the underlying LMDB skips fsync. Only safe for throwaway
    // databases (the fuzz target wipes on reset). Not transferred to worker
    // threads, so the durable main node path always gets the default.
    public readonly ephemeral: boolean = false,
  ) {}

  openDatabase(options: { readonly: boolean } = { readonly: true }): RootDb<BlocksDb, SerializedStatesDb> {
    const lmdb = LmdbRoot.new(this.dbPath, {
      readOnly: options.readonly,
      ephemeral: this.ephemeral,
    });

    return {
      getBlocksDb: () => LmdbBlocks.new(this.chainSpec, lmdb),
      getStatesDb: () => LmdbStates.new(this.chainSpec, this.blake2b, lmdb),
      close: async () => await lmdb.close(),
    };
  }

  /** Convert this config into a thread-transferable object. */
  intoTransferable(paramsCodec: Encode<T>): TransferableConfig {
    return {
      nodeName: this.nodeName,
      chainSpec: this.chainSpec,
      workerParams: Encoder.encodeObject(paramsCodec, this.workerParams, this.chainSpec).raw,
      dbPath: this.dbPath,
      workerPorts: Array.from(this.ports.entries()).map(([name, port]) => [name, port.intoTransferable()]),
    };
  }
}

/** Config that's safe to transfer between worker threads. */
export type TransferableConfig = {
  nodeName: string;
  chainSpec: ChainSpec;
  workerParams: Uint8Array;
  dbPath: string;
  workerPorts: [string, TransferablePort][];
};

/**
 * Collect the transferable objects (communication ports) embedded in a config.
 *
 * `MessagePort`s can only be transferred, not structurally cloned, so they have to
 * be listed in the `postMessage` transfer list. Omitting them results in a
 * `DataCloneError`.
 */
export function configTransferList(config: TransferableConfig): MessagePort[] {
  return config.workerPorts.map(([, transferable]) => transferable.port);
}

/**
 * In-memory (direct) worker using serialized state database.
 *
 * Note the database is always empty, and needs to be initialized.
 */
export class InMemWorkerConfig<T = undefined> implements WorkerConfig<T, BlocksDb, SerializedStatesDb> {
  static new<T>({
    nodeName,
    chainSpec,
    workerParams,
    blake2b,
  }: {
    nodeName: string;
    chainSpec: ChainSpec;
    workerParams: T;
    blake2b: Blake2b;
  }) {
    return new InMemWorkerConfig(nodeName, chainSpec, workerParams, blake2b);
  }

  private readonly blocks: InMemoryBlocks;
  private readonly states: InMemorySerializedStates;

  private constructor(
    public readonly nodeName: string,
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

/** Persistent values store backing the hybrid config. */
export type HybridBackend = "lmdb" | "fjall";

/**
 * Hybrid worker config for the fuzz target: in-memory blocks and leaf sets,
 * but large values persisted to disk (LMDB or fjall, selected by `backend`).
 *
 * The fjall backend is opt-in so its performance can be compared against LMDB
 * before committing to it. fjall opens its keyspace asynchronously, hence the
 * async `new`.
 *
 * Like `InMemWorkerConfig`, the blocks and leaf sets are shared across the
 * open/close/reopen dance that genesis init performs, so `openDatabase`
 * returns the same instances and a no-op close. The values store is opened once
 * here and closed by `HybridSerializedStates.close()` at importer teardown.
 *
 * In-process only: it holds shared mutable state (the in-memory leaf
 * dictionary) and so is not thread-transferable. The fuzz target runs the
 * importer in-process via `createImporter`, not in a spawned worker.
 */
export class HybridWorkerConfig<T = undefined> implements WorkerConfig<T, BlocksDb, SerializedStatesDb> {
  static async new<T>({
    nodeName,
    chainSpec,
    workerParams,
    blake2b,
    dbPath,
    ephemeral = false,
    compression = true,
    backend = "lmdb",
  }: {
    nodeName: string;
    chainSpec: ChainSpec;
    workerParams: T;
    blake2b: Blake2b;
    dbPath: string;
    ephemeral?: boolean;
    compression?: boolean;
    backend?: HybridBackend;
  }): Promise<HybridWorkerConfig<T>> {
    // fjall opens its keyspace asynchronously; LMDB is synchronous. Either way
    // the values store is created once here and shared across reopen.
    const states =
      backend === "fjall"
        ? await FjallHybridSerializedStates.new({ spec: chainSpec, blake2b, dbPath, ephemeral })
        : LmdbHybridSerializedStates.new({ spec: chainSpec, blake2b, dbPath, ephemeral, compression, readOnly: false });
    return new HybridWorkerConfig(nodeName, chainSpec, workerParams, blake2b, dbPath, ephemeral, compression, states);
  }

  private readonly blocks: InMemoryBlocks;

  private constructor(
    public readonly nodeName: string,
    public readonly chainSpec: ChainSpec,
    public readonly workerParams: T,
    public readonly blake2b: Blake2b,
    public readonly dbPath: string,
    public readonly ephemeral: boolean,
    public readonly compression: boolean,
    private readonly states: SerializedStatesDb,
  ) {
    this.blocks = InMemoryBlocks.new();
  }

  openDatabase(_options: { readonly: boolean } = { readonly: true }): RootDb<BlocksDb, SerializedStatesDb> {
    return {
      getBlocksDb: () => this.blocks,
      getStatesDb: () => this.states,
      // Leaf sets and blocks live in memory; the values store is closed via
      // states.close() at importer teardown, so this is a no-op.
      close: async () => {},
    };
  }
}
