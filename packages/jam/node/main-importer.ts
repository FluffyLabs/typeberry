import type { BlockView, HeaderHash, StateRootHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { PvmBackend } from "@typeberry/config";
import { KnownChainSpec, RegularStateBackend } from "@typeberry/config-node";
import { bandersnatch, initWasm } from "@typeberry/crypto";
import { Blake2b, HASH_SIZE } from "@typeberry/hash";
import { createImporter, ImporterConfig } from "@typeberry/importer";
import { tryAsU16 } from "@typeberry/numbers";
import { CURRENT_SUITE, CURRENT_VERSION, Result, resultToString, version } from "@typeberry/utils";
import {
  type FjallValuesSession,
  FjallWorkerConfig,
  HybridWorkerConfig,
  InMemWorkerConfig,
  LmdbWorkerConfig,
} from "@typeberry/workers-api-node";
import { getChainSpec, getDatabasePath, initializeDatabase, logger } from "./common.js";
import type { JamConfig } from "./jam-config.js";
import type { NodeApi } from "./main.js";

const zeroHash = Bytes.zero(HASH_SIZE).asOpaque<StateRootHash>();

export type StateBackend = "lmdb" | "fjall" | "lmdb-hybrid" | "fjall-hybrid";

export type ImporterOptions = {
  initGenesisFromAncestry?: boolean;
  dummyFinalityDepth?: number;
  pruneBlocks?: boolean;
  /** Open the database without fsync/compression. Only safe for throwaway dbs (e.g. fuzzing). */
  ephemeral?: boolean;
  /**
   * Persistent backend used when `databaseBasePath` is set. Defaults to config's backend (fjall unless overridden).
   *
   * lmdb and lmdb-hybrid are deprecated and retained as explicit fallbacks.
   */
  stateBackend?: StateBackend;
  /**
   * Reuse an already-open fjall values session instead of opening a fresh
   * keyspace. Only used when `stateBackend === "fjall-hybrid"`. The fuzz target
   * opens one per run and reuses it across resets.
   */
  sharedFjallSession?: FjallValuesSession;
};

export async function mainImporter(
  config: JamConfig,
  withRelPath: (v: string) => string,
  options: ImporterOptions = {},
): Promise<NodeApi> {
  await initWasm();
  const bandesnatchNative = bandersnatch.checkNativeBindings();

  logger.info`🫐 Typeberry ${version}. GP: ${CURRENT_VERSION} (${CURRENT_SUITE})`;
  logger.info`🎸 Starting importer: ${config.nodeName}.`;
  logger.info`🖥️ PVM Backend: ${PvmBackend[config.pvmBackend]}.`;
  logger.info`🐇 Bandersnatch ${bandesnatchNative.isOk ? "native 🚀" : `using wasm: ${bandesnatchNative.error}`}`;

  // Single source of truth for the states db backend: drives both the log line
  // below and the worker config picked further down.
  const dbBackend =
    config.node.databaseBasePath === undefined
      ? "in-memory"
      : (options.stateBackend ?? config.node.stateBackend ?? RegularStateBackend.Fjall);
  logger.info`🗄️ States DB: ${dbBackend}.`;
  if (dbBackend === "lmdb" || dbBackend === "lmdb-hybrid") {
    logger.warn`🗄️ The ${dbBackend} state backend is deprecated. Use fjall unless you need a temporary fallback.`;
  }

  const chainSpec = getChainSpec(config.node.flavor);
  const blake2b = await Blake2b.createHasher();
  const nodeName = config.nodeName;

  const { dbPath, genesisHeaderHash } = getDatabasePath(
    blake2b,
    config.nodeName,
    config.node.chainSpec.genesisHeader,
    withRelPath(config.node.databaseBasePath ?? "<in-memory>"),
  );

  const workerParams = ImporterConfig.create({
    pvm: config.pvmBackend,
    dummyFinalityDepth: tryAsU16(options.dummyFinalityDepth ?? 0),
    pruneBlocks: options.pruneBlocks ?? false,
  });

  const ephemeral = options.ephemeral ?? false;
  // enable compression when running full test suite
  const compression = ephemeral && config.node.flavor === KnownChainSpec.Full;
  const workerConfig =
    dbBackend === "in-memory"
      ? InMemWorkerConfig.new({
          nodeName,
          chainSpec,
          blake2b,
          workerParams,
        })
      : dbBackend === "lmdb-hybrid" || dbBackend === "fjall-hybrid"
        ? await HybridWorkerConfig.new({
            nodeName,
            chainSpec,
            blake2b,
            dbPath,
            workerParams,
            ephemeral,
            compression,
            backend: dbBackend === "lmdb-hybrid" ? "lmdb" : "fjall",
            sharedFjallSession: options.sharedFjallSession,
          })
        : dbBackend === "fjall"
          ? FjallWorkerConfig.new({
              nodeName,
              chainSpec,
              blake2b,
              dbPath,
              workerParams,
              ephemeral,
            })
          : LmdbWorkerConfig.new({
              nodeName,
              chainSpec,
              blake2b,
              dbPath,
              workerParams,
              ephemeral,
            });

  // Initialize the database with genesis state and block if there isn't one.
  logger.info`🛢️ Opening database at ${dbPath}`;
  const rootDb = await workerConfig.openDatabase({ readonly: false });
  await initializeDatabase(chainSpec, blake2b, genesisHeaderHash, rootDb, config.node.chainSpec, config.ancestry, {
    initGenesisFromAncestry: options.initGenesisFromAncestry,
  });
  const { db, importer } = await createImporter(workerConfig, {
    initGenesisFromAncestry: options.initGenesisFromAncestry,
    db: rootDb,
  });
  await importer.prepareForNextEpoch();

  const api: NodeApi = {
    chainSpec,
    async importBlock(block: BlockView): Promise<Result<StateRootHash, string>> {
      const res = await importer.importBlockWithStateRoot(block);
      if (res.isOk) {
        return res;
      }
      const errMsg = resultToString(res);
      return Result.error(errMsg, () => errMsg);
    },
    async getStateEntries(hash: HeaderHash) {
      return importer.getStateEntries(hash);
    },
    async getBestStateRootHash() {
      return importer.getBestStateRootHash() ?? zeroHash;
    },
    async close() {
      logger.log`[main] ⏳ Closing importer`;
      await importer.close();
      logger.log`[main] 🛢️ Closing database`;
      await db.close();
      logger.info`[main] ✅ Done.`;
    },
  };

  return api;
}
