import type { BlockView, HeaderHash, StateRootHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { PvmBackend } from "@typeberry/config";
import { initWasm } from "@typeberry/crypto";
import { Blake2b, HASH_SIZE } from "@typeberry/hash";
import { createImporter } from "@typeberry/importer";
import { CURRENT_SUITE, CURRENT_VERSION, Result, resultToString } from "@typeberry/utils";
import { InMemWorkerConfig, LmdbWorkerConfig } from "@typeberry/workers-api-node";
import { getChainSpec, getDatabasePath, initializeDatabase, logger } from "./common.js";
import type { JamConfig } from "./jam-config.js";
import type { NodeApi } from "./main.js";
import packageJson from "./package.json" with { type: "json" };

const zeroHash = Bytes.zero(HASH_SIZE).asOpaque<StateRootHash>();

export async function mainImporter(config: JamConfig, withRelPath: (v: string) => string): Promise<NodeApi> {
  await initWasm();

  logger.info`🫐 Typeberry ${packageJson.version}. GP: ${CURRENT_VERSION} (${CURRENT_SUITE})`;
  logger.info`🎸 Starting importer: ${config.nodeName}.`;
  logger.info`🖥️ PVM Backend: ${PvmBackend[config.pvmBackend]}.`;
  const chainSpec = getChainSpec(config.node.flavor);
  const blake2b = await Blake2b.createHasher();
  const nodeName = config.nodeName;
  const omitSealVerification = false;

  const { dbPath, genesisHeaderHash } = getDatabasePath(
    blake2b,
    config.nodeName,
    config.node.chainSpec.genesisHeader,
    withRelPath(config.node.databaseBasePath ?? "<in-memory>"),
  );

  const workerConfig =
    config.node.databaseBasePath === undefined
      ? InMemWorkerConfig.new({
          nodeName,
          chainSpec,
          blake2b,
          workerParams: {
            pvm: config.pvmBackend,
            omitSealVerification,
          },
        })
      : LmdbWorkerConfig.new({
          nodeName,
          chainSpec,
          blake2b,
          dbPath,
          workerParams: {
            pvm: config.pvmBackend,
            omitSealVerification,
          },
        });

  // Initialize the database with genesis state and block if there isn't one.
  logger.info`🛢️ Opening database at ${dbPath}`;
  const rootDb = workerConfig.openDatabase({ readonly: false });
  await initializeDatabase(chainSpec, blake2b, genesisHeaderHash, rootDb, config.node.chainSpec, config.ancestry);
  await rootDb.close();

  const { db, importer } = await createImporter(workerConfig);
  await importer.prepareForNextEpoch();

  const api: NodeApi = {
    chainSpec,
    async importBlock(block: BlockView): Promise<Result<StateRootHash, string>> {
      const res = await importer.importBlockWithStateRoot(block, omitSealVerification);
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
      logger.log`[main] 🛢️ Closing the database`;
      await db.close();
      logger.info`[main] ✅ Done.`;
    },
  };

  return api;
}
