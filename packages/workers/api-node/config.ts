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
import {
  FjallBlocks,
  FjallRoot,
  FjallStates,
  HybridSerializedStates as FjallHybridSerializedStates,
  FjallValuesSession,
} from "@typeberry/database-fjall";
import {
  LmdbBlocks,
  HybridSerializedStates as LmdbHybridSerializedStates,
  LmdbRoot,
  LmdbStates,
} from "@typeberry/database-lmdb";
import { Blake2b } from "@typeberry/hash";
import type { WorkerConfig } from "@typeberry/workers-api";
import { ThreadPort, type TransferablePort } from "./port.js";

// Re-exported so the fuzz target can open one values session per run and reuse
// it across resets (see `HybridWorkerConfig` / `mainFuzz`).
export { FjallValuesSession };

/** Persistent regular-node backend. */
export type PersistentBackend = "lmdb" | "fjall";

/** Transferable worker config for persistent regular-node workers. */
export type PersistentWorkerConfig<T> = LmdbWorkerConfig<T> | FjallWorkerConfig<T>;

/**
 * Worker config for node.js, backed by the LMDB database.
 *
 * @deprecated lmdb is retained as an explicit fallback. Use `FjallWorkerConfig` for regular nodes.
 */
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
    if (config.databaseBackend !== "lmdb") {
      throw new Error(`Expected lmdb worker config, got ${config.databaseBackend}.`);
    }
    const { blake2b, chainSpec, workerParams, ports } = await decodeTransferableConfig(decodeParams, config);

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
    // When set, the underlying database skips fsync. Only safe for throwaway
    // databases (the fuzz target wipes on reset). Not transferred to worker
    // threads, so the durable main node path always gets the default.
    public readonly ephemeral: boolean = false,
  ) {}

  async openDatabase(
    options: { readonly: boolean } = { readonly: true },
  ): Promise<RootDb<BlocksDb, SerializedStatesDb>> {
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
      databaseBackend: "lmdb",
      nodeName: this.nodeName,
      chainSpec: this.chainSpec,
      workerParams: Encoder.encodeObject(paramsCodec, this.workerParams, this.chainSpec).raw,
      dbPath: this.dbPath,
      workerPorts: Array.from(this.ports.entries()).map(([name, port]) => [name, port.intoTransferable()]),
    };
  }
}

/** Worker config for node.js, backed by a shared fjall engine. */
export class FjallWorkerConfig<T = void> implements WorkerConfig<T, BlocksDb, SerializedStatesDb> {
  static new<T>({
    nodeName,
    chainSpec,
    workerParams,
    dbPath,
    blake2b,
    ports = new Map(),
    ephemeral = false,
    cacheSizeBytes,
  }: {
    nodeName: string;
    chainSpec: ChainSpec;
    workerParams: T;
    dbPath: string;
    blake2b: Blake2b;
    ports?: Map<string, ThreadPort>;
    ephemeral?: boolean;
    cacheSizeBytes?: number;
  }) {
    return new FjallWorkerConfig(nodeName, chainSpec, workerParams, dbPath, blake2b, ports, ephemeral, cacheSizeBytes);
  }

  /** Restore node config from a transferable config object. */
  static async fromTransferable<T>(decodeParams: Decode<T>, config: TransferableConfig) {
    if (config.databaseBackend !== "fjall") {
      throw new Error(`Expected fjall worker config, got ${config.databaseBackend}.`);
    }
    const { blake2b, chainSpec, workerParams, ports } = await decodeTransferableConfig(decodeParams, config);

    return FjallWorkerConfig.new({
      nodeName: config.nodeName,
      chainSpec,
      workerParams,
      dbPath: config.dbPath,
      blake2b,
      ports,
      cacheSizeBytes: config.cacheSizeBytes,
    });
  }

  private constructor(
    public readonly nodeName: string,
    public readonly chainSpec: ChainSpec,
    public readonly workerParams: T,
    public readonly dbPath: string,
    public readonly blake2b: Blake2b,
    public readonly ports: Map<string, ThreadPort>,
    // Kept for the fuzz/importer path. When set, persist() is skipped.
    public readonly ephemeral: boolean = false,
    public readonly cacheSizeBytes: number | undefined = undefined,
  ) {}

  async openDatabase(
    options: { readonly: boolean } = { readonly: true },
  ): Promise<RootDb<BlocksDb, SerializedStatesDb>> {
    const fjall = await FjallRoot.open(this.dbPath, {
      readOnly: options.readonly,
      ephemeral: this.ephemeral,
      cacheSizeBytes: this.cacheSizeBytes,
    });
    const [blocks, states] = await Promise.all([
      FjallBlocks.open(this.chainSpec, fjall),
      FjallStates.open(this.chainSpec, this.blake2b, fjall),
    ]);

    return {
      getBlocksDb: () => blocks,
      getStatesDb: () => states,
      close: async () => await fjall.close(),
    };
  }

  /** Convert this config into a thread-transferable object. */
  intoTransferable(paramsCodec: Encode<T>): TransferableConfig {
    return {
      databaseBackend: "fjall",
      nodeName: this.nodeName,
      chainSpec: this.chainSpec,
      workerParams: Encoder.encodeObject(paramsCodec, this.workerParams, this.chainSpec).raw,
      dbPath: this.dbPath,
      workerPorts: Array.from(this.ports.entries()).map(([name, port]) => [name, port.intoTransferable()]),
      cacheSizeBytes: this.cacheSizeBytes,
    };
  }
}

/** Config that's safe to transfer between worker threads. */
export type TransferableConfig = {
  databaseBackend: PersistentBackend;
  nodeName: string;
  chainSpec: ChainSpec;
  workerParams: Uint8Array;
  dbPath: string;
  workerPorts: [string, TransferablePort][];
  cacheSizeBytes?: number;
};

async function decodeTransferableConfig<T>(decodeParams: Decode<T>, config: TransferableConfig) {
  const blake2b = await Blake2b.createHasher();
  const chainSpec = ChainSpec.new(config.chainSpec);
  const workerParams = Decoder.decodeObject(decodeParams, config.workerParams, chainSpec);
  const ports = new Map(config.workerPorts.map(([name, port]) => [name, ThreadPort.fromTransferable(chainSpec, port)]));

  return {
    blake2b,
    chainSpec,
    workerParams,
    ports,
  };
}

/** Restore a persistent worker config from its transferable form. */
export async function persistentConfigFromTransferable<T>(
  decodeParams: Decode<T>,
  config: TransferableConfig,
): Promise<PersistentWorkerConfig<T>> {
  switch (config.databaseBackend) {
    case "lmdb":
      return LmdbWorkerConfig.fromTransferable(decodeParams, config);
    case "fjall":
      return FjallWorkerConfig.fromTransferable(decodeParams, config);
  }
}

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

  async openDatabase(
    _options: { readonly: boolean } = { readonly: true },
  ): Promise<RootDb<BlocksDb, SerializedStatesDb>> {
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
 * but large values persisted to disk. The `backend` picks where the values go
 * (lmdb or fjall).
 *
 * fjall opens its keyspace asynchronously, that is why `new` here is async.
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
    sharedFjallSession,
  }: {
    nodeName: string;
    chainSpec: ChainSpec;
    workerParams: T;
    blake2b: Blake2b;
    dbPath: string;
    ephemeral?: boolean;
    compression?: boolean;
    backend?: HybridBackend;
    /**
     * Reuse an already-open fjall values session instead of opening a fresh
     * keyspace. The fuzz target opens one per run and passes it on every reset,
     * so only the in-memory blocks/leaf sets are rebuilt per vector. Ignored
     * unless `backend === "fjall"`.
     */
    sharedFjallSession?: FjallValuesSession;
  }): Promise<HybridWorkerConfig<T>> {
    // The values store is created once here and shared across reopen. When a
    // session is given (fuzz reset reuse) we wrap it instead of opening a new one.
    const states =
      backend === "fjall"
        ? sharedFjallSession !== undefined
          ? FjallHybridSerializedStates.fromSession(chainSpec, blake2b, sharedFjallSession)
          : await FjallHybridSerializedStates.new({ spec: chainSpec, blake2b, dbPath, ephemeral })
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

  async openDatabase(
    _options: { readonly: boolean } = { readonly: true },
  ): Promise<RootDb<BlocksDb, SerializedStatesDb>> {
    return {
      getBlocksDb: () => this.blocks,
      getStatesDb: () => this.states,
      // Leaf sets and blocks live in memory; the values store is closed via
      // states.close() at importer teardown, so this is a no-op.
      close: async () => {},
    };
  }
}
