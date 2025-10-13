import type { BlockView, HeaderHash, StateRootHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { initWasm } from "@typeberry/crypto";
import { Blake2b, HASH_SIZE } from "@typeberry/hash";
import { createImporter } from "@typeberry/importer";
import { CURRENT_SUITE, CURRENT_VERSION, Result, resultToString } from "@typeberry/utils";
import { NodeConfig } from "@typeberry/workers-api-node";
import { getChainSpec, initializeDatabase, logger, openDatabase } from "./common.js";
import type { JamConfig } from "./jam-config.js";
import type { NodeApi } from "./main.js";
import packageJson from "./package.json" with { type: "json" };

const zeroHash = Bytes.zero(HASH_SIZE).asOpaque<StateRootHash>();

export async function mainImporter(config: JamConfig, withRelPath: (v: string) => string): Promise<NodeApi> {
  await initWasm();

  logger.info`🫐 Typeberry ${packageJson.version}. GP: ${CURRENT_VERSION} (${CURRENT_SUITE})`;
  logger.info`🎸 Starting importer: ${config.nodeName}.`;
  const chainSpec = getChainSpec(config.node.flavor);
  const blake2b = await Blake2b.createHasher();
  const { rootDb, dbPath, genesisHeaderHash } = openDatabase(
    blake2b,
    config.nodeName,
    config.node.chainSpec.genesisHeader,
    withRelPath(config.node.databaseBasePath),
  );

  // Initialize the database with genesis state and block if there isn't one.
  await initializeDatabase(chainSpec, blake2b, genesisHeaderHash, rootDb, config.node.chainSpec, config.ancestry);
  await rootDb.close();

  const omitSealVerification = false;
  const workerConfig = NodeConfig.new({
    chainSpec,
    blake2b,
    dbPath,
    workerParams: {
      omitSealVerification,
    },
  });
  const { db, importer } = await createImporter(workerConfig);
  await importer.prepareForNextEpoch();

  const api: NodeApi = {
    chainSpec,
    async importBlock(block: BlockView): Promise<Result<StateRootHash, string>> {
      const res = await importer.importBlock(block, omitSealVerification);
      if (res.isOk) {
        return Result.ok(importer.getBestStateRootHash() ?? zeroHash);
      }
      return Result.error(resultToString(res));
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
