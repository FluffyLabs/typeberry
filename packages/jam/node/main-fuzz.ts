import { rm } from "node:fs/promises";
import { type BlockView, Header, type HeaderHash, type StateRootHash, type TimeSlot } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { PvmBackend } from "@typeberry/config";
import { type FuzzVersion, startFuzzTarget } from "@typeberry/ext-ipc";
import { v1 as fuzzV1 } from "@typeberry/fuzz-proto";
import { HASH_SIZE } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import type { StateEntries } from "@typeberry/state-merkleization";
import { type Closer, CURRENT_VERSION, Result, version } from "@typeberry/utils";
import { FjallRoot, logHostEnvironment } from "@typeberry/workers-api-node";
import { getChainSpec } from "./common.js";
import type { JamConfig } from "./jam-config.js";
import type { NodeApi } from "./main.js";
import { mainImporter, type StateBackend } from "./main-importer.js";

export type FuzzConfig = {
  version: FuzzVersion;
  jamNodeConfig: JamConfig;
  socket: string | null;
  initGenesisFromAncestry: boolean;
};

const logger = Logger.new(import.meta.filename, "fuzztarget");

/** Dedicated subdirectory under the configured base path that the fuzzer owns and wipes. */
const FUZZ_DB_SUBDIR = "typeberry-fuzz-db";

const FUZZ_DB_FJALL: StateBackend = "fjall-hybrid";
const FUZZ_DB_OPTIONS: string[] = [FUZZ_DB_FJALL, "fjall"];

/** The partitions used by FjallBlocks and FjallStates in the full-fjall backend. */
const FUZZ_FJALL_PARTITIONS = ["headers", "extrinsics", "postStateRoots", "states", "values"] as const;
/**
 * Size of the fjall block-cache for the fuzz session. The keyspace stays open
 * across resets, so this cache is what keeps the resident memory bounded.
 */
const FUZZ_FJALL_CACHE_BYTES = 128 * 1024 * 1024;
/** Rebuild reused fjall keyspaces every N resets to limit LSM write/read amplification. */
const REBUILD_FJALL_KEYSPACE_EVERY = 50;

/**
 * Resolve the directory the fuzzer should use for its on-disk database, or
 * `undefined` for an in-memory database. The dedicated `FUZZ_DB_SUBDIR` is
 * appended so we only ever wipe a directory the fuzzer owns, never the base
 * path the harness handed us.
 *
 * The empty / "undefined" guards are defensive: the env flow already normalizes via fuzzDatabaseBasePath,
 * but the CLI fuzz-target path can set databaseBasePath directly without going through fuzz-env's normalization.
 */
export function resolveFuzzDbBase(configured: string | undefined): string | undefined {
  if (configured === undefined) {
    return undefined;
  }
  const trimmed = configured.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "undefined") {
    return undefined;
  }
  return `${trimmed}/${FUZZ_DB_SUBDIR}`;
}

/** Recursively remove the fuzzer's database directory. No-op if it is absent. */
export async function wipeFuzzDb(base: string): Promise<void> {
  await rm(base, { recursive: true, force: true });
}

export function getFuzzDetails() {
  return {
    nodeName: "@typeberry/jam",
    nodeVersion: fuzzV1.Version.tryFromString(version),
    gpVersion: fuzzV1.Version.tryFromString(CURRENT_VERSION),
  };
}

export async function mainFuzz(fuzzConfig: FuzzConfig, withRelPath: (v: string) => string): Promise<{ close: Closer }> {
  logger.info`💨 Fuzzer V${fuzzConfig.version} starting up.`;
  logger.info`🖥️ PVM Backend: ${PvmBackend[fuzzConfig.jamNodeConfig.pvmBackend]}.`;
  logHostEnvironment(logger);

  const { jamNodeConfig: config } = fuzzConfig;

  const fuzzDbBase = resolveFuzzDbBase(config.node.databaseBasePath);

  const rawFuzzDb = process.env.JAM_FUZZ_DB?.trim() ?? "";
  const hybridStateBackend = rawFuzzDb === "" ? FUZZ_DB_FJALL : rawFuzzDb;
  if (!isValidStateBackend(hybridStateBackend)) {
    throw new Error(`JAM_FUZZ_DB must be one of: ${FUZZ_DB_OPTIONS} (got: "${rawFuzzDb}").`);
  }
  if (fuzzDbBase !== undefined) {
    logger.info`🗄️ Fuzz persistent backend: ${hybridStateBackend}.`;
  }

  let runningNode: NodeApi | null = null;
  // The fjall keyspace is opened once per fuzz session and reused on every
  // reset, because opening it is the slow part.
  let fjallKeyspace: FjallRoot | null = null;
  // Track how many times resetState has been called for periodic fjall keyspace rebuilds.
  let resetCount = 0;
  // Set when close() starts. Guards resetState so a fuzz command arriving
  // mid-shutdown can't build a fresh node that close() then orphans.
  let isClosing = false;
  let activeReset: Promise<StateRootHash> | null = null;

  const chainSpec = getChainSpec(config.node.flavor);

  const closeFuzzTarget = startFuzzTarget(fuzzConfig.version, fuzzConfig.socket, {
    ...getFuzzDetails(),
    chainSpec,
    importBlock: async (blockView: BlockView): Promise<Result<StateRootHash, string>> => {
      if (runningNode === null) {
        return Result.error("node not running", () => "Fuzzer: node not running when importing block");
      }
      const importResult = await runningNode.importBlock(blockView);
      return importResult;
    },
    getBestStateRootHash: async (): Promise<StateRootHash> => {
      if (runningNode === null) {
        return Bytes.zero(HASH_SIZE).asOpaque();
      }
      return runningNode.getBestStateRootHash();
    },
    getPostSerializedState: async (hash: HeaderHash): Promise<StateEntries | null> => {
      if (runningNode === null) {
        return null;
      }
      return runningNode.getStateEntries(hash);
    },
    resetState: (header: Header, state: StateEntries, ancestry: [HeaderHash, TimeSlot][]): Promise<StateRootHash> => {
      const reset = (async () => {
        if (isClosing) {
          return Bytes.zero(HASH_SIZE).asOpaque();
        }
        if (runningNode !== null) {
          const finish = runningNode.close();
          runningNode = null;
          await finish;
        }

        // Increment reset counter for periodic fjall session rebuilds.
        resetCount++;

        const buildNode = (databaseBasePath: string | undefined) => {
          const isPersistent = databaseBasePath !== undefined;
          return mainImporter(
            {
              ...config,
              node: {
                ...config.node,
                databaseBasePath,
                chainSpec: {
                  ...config.node.chainSpec,
                  genesisHeader: Encoder.encodeObject(Header.Codec, header, chainSpec),
                  genesisState: new Map(state),
                },
              },
              ancestry,
              network: null,
            },
            withRelPath,
            {
              initGenesisFromAncestry: fuzzConfig.initGenesisFromAncestry,
              // Hybrid keeps leaf sets in RAM, so they must be windowed exactly
              // like the in-memory backend; only the large values live on disk.
              dummyFinalityDepth: 20,
              pruneBlocks: true,
              // The on-disk fuzz db is throwaway (we wipe it), so open it ephemeral and
              // skip the fsync, we do not need durability here. On full spec ephemeral
              // also turns on compression further down, so the big values do not grow the
              // db too much. Tiny stays uncompressed, its db is small and speed matters more.
              ephemeral: isPersistent,
              stateBackend: isPersistent ? hybridStateBackend : "fjall",
              // Reuse the keyspace for both fjall backends. Nothing to pass for
              // the in-memory fallback.
              sharedFjallKeyspace: fjallKeyspace ?? undefined,
            },
          );
        };

        if (fuzzDbBase !== undefined) {
          try {
            const fjallKeyspacePath = withRelPath(fuzzDbBase);
            if (hybridStateBackend === FUZZ_DB_FJALL) {
              // fjall-hybrid: values pile up across resets, so rebuild the
              // keyspace periodically to avoid LSM read amplification.
              if (resetCount === 1 || fjallKeyspace === null) {
                // First reset: start from a clean slate.
                await wipeFuzzDb(fuzzDbBase);
                fjallKeyspace = await FjallRoot.open(fjallKeyspacePath, {
                  ephemeral: true,
                  cacheSizeBytes: FUZZ_FJALL_CACHE_BYTES,
                });
                logger.info`🗄️ Opened reusable fjall keyspace at ${fjallKeyspacePath}`;
              } else if (resetCount % REBUILD_FJALL_KEYSPACE_EVERY === 0) {
                // Periodic rebuild: close, wipe keyspace dir, and reopen.
                const keyspace = fjallKeyspace;
                fjallKeyspace = null;
                await keyspace.close().catch(() => {});
                await wipeFuzzDb(fuzzDbBase).catch(() => {});
                fjallKeyspace = await FjallRoot.open(fjallKeyspacePath, {
                  ephemeral: true,
                  cacheSizeBytes: FUZZ_FJALL_CACHE_BYTES,
                });
                logger.info`🗄️ Rebuilt reusable fjall keyspace at ${fjallKeyspacePath}`;
              }
            } else {
              // full-fjall: keep one keyspace open and recycle only the five
              // partitions used by FjallBlocks/FjallStates.
              if (resetCount === 1 || fjallKeyspace === null) {
                await wipeFuzzDb(fuzzDbBase);
                fjallKeyspace = await FjallRoot.open(fjallKeyspacePath, {
                  ephemeral: true,
                  cacheSizeBytes: FUZZ_FJALL_CACHE_BYTES,
                });
                logger.info`🗄️ Opened reusable fjall keyspace at ${fjallKeyspacePath}`;
              } else if (resetCount % REBUILD_FJALL_KEYSPACE_EVERY === 0) {
                // Periodic rebuild: delete/recreate keeps correctness, but a
                // long-lived keyspace accumulates fjall write amplification.
                const keyspace = fjallKeyspace;
                fjallKeyspace = null;
                await keyspace.close().catch(() => {});
                await wipeFuzzDb(fuzzDbBase).catch(() => {});
                fjallKeyspace = await FjallRoot.open(fjallKeyspacePath, {
                  ephemeral: true,
                  cacheSizeBytes: FUZZ_FJALL_CACHE_BYTES,
                });
                logger.info`🗄️ Rebuilt reusable fjall keyspace at ${fjallKeyspacePath}`;
              } else if (fjallKeyspace !== null) {
                const keyspace = fjallKeyspace;
                await Promise.all(FUZZ_FJALL_PARTITIONS.map((name) => keyspace.deletePartition(name)));
              }
            }
            runningNode = await buildNode(fuzzDbBase);
            return await runningNode.getBestStateRootHash();
          } catch (e) {
            // A partially-opened db may leak on failure; acceptable for this degraded fallback (proper cleanup belongs in mainImporter).
            logger.warn`Failed to open persistent fuzz db at ${fuzzDbBase}, falling back to in-memory: ${e}`;
            runningNode = null;
          }
        }

        runningNode = await buildNode(undefined);
        return await runningNode.getBestStateRootHash();
      })();
      activeReset = reset;
      const clearActiveReset = () => {
        if (activeReset === reset) {
          activeReset = null;
        }
      };
      reset.then(clearActiveReset, clearActiveReset);
      return reset;
    },
  });

  return {
    close: async () => {
      isClosing = true;
      // Stop accepting connections + unlink the socket.
      closeFuzzTarget();
      // Drain the active reset (flush + close DB). Swallow errors so a
      // failing close still lets the process exit 0; the db is wiped next.
      // The node references the shared fjall keyspace, so it must close first.
      if (activeReset !== null) {
        await activeReset.catch((e) => logger.error`Error waiting for fuzz reset: ${e}`);
      }
      if (runningNode !== null) {
        const node = runningNode;
        runningNode = null;
        await node.close().catch((e) => logger.error`Error closing fuzz node: ${e}`);
      }
      // Release the reused fjall keyspace before wiping its files.
      if (fjallKeyspace !== null) {
        const keyspace = fjallKeyspace;
        fjallKeyspace = null;
        await keyspace.close().catch((e) => logger.error`Error closing fjall keyspace: ${e}`);
      }
      if (fuzzDbBase !== undefined) {
        await wipeFuzzDb(fuzzDbBase).catch(() => {});
      }
    },
  };
}

function isValidStateBackend(val: string): val is StateBackend {
  return FUZZ_DB_OPTIONS.indexOf(val) !== -1;
}
