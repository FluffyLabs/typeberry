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
import { CURRENT_VERSION, Result, version } from "@typeberry/utils";
import { logHostEnvironment } from "@typeberry/workers-api-node";
import { getChainSpec } from "./common.js";
import type { JamConfig } from "./jam-config.js";
import type { NodeApi } from "./main.js";
import { mainImporter } from "./main-importer.js";

export type FuzzConfig = {
  version: FuzzVersion;
  jamNodeConfig: JamConfig;
  socket: string | null;
  initGenesisFromAncestry: boolean;
};

const logger = Logger.new(import.meta.filename, "fuzztarget");

/** Dedicated subdirectory under the configured base path that the fuzzer owns and wipes. */
const FUZZ_DB_SUBDIR = "typeberry-fuzz-db";

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

export async function mainFuzz(fuzzConfig: FuzzConfig, withRelPath: (v: string) => string) {
  logger.info`💨 Fuzzer V${fuzzConfig.version} starting up.`;
  logger.info`🖥️ PVM Backend: ${PvmBackend[fuzzConfig.jamNodeConfig.pvmBackend]}.`;
  logHostEnvironment(logger);

  const { jamNodeConfig: config } = fuzzConfig;

  const fuzzDbBase = resolveFuzzDbBase(config.node.databaseBasePath);

  let runningNode: NodeApi | null = null;

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
    resetState: async (
      header: Header,
      state: StateEntries,
      ancestry: [HeaderHash, TimeSlot][],
    ): Promise<StateRootHash> => {
      if (runningNode !== null) {
        const finish = runningNode.close();
        runningNode = null;
        await finish;
      }

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
            // The fuzz db is wiped on every reset, so durability is pointless:
            // skip fsync + compression to cut the per-block value write cost.
            ephemeralDb: isPersistent,
            stateBackend: isPersistent ? "hybrid" : "lmdb",
          },
        );
      };

      if (fuzzDbBase !== undefined) {
        // Each reset starts a fresh session from the genesis the fuzzer just sent,
        // so the on-disk db must be empty: otherwise initializeDatabase sees an
        // already-initialized db and silently resumes the previous run's state.
        await wipeFuzzDb(fuzzDbBase);
        try {
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
    },
  });

  return () => {
    closeFuzzTarget();
    if (fuzzDbBase !== undefined) {
      // best-effort cleanup on shutdown; ignore failures (dir may already be gone).
      wipeFuzzDb(fuzzDbBase).catch(() => {});
    }
  };
}
