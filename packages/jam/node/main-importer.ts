import type { BlockView, HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Decoder } from "@typeberry/codec";
import { WorkerConfig } from "@typeberry/config";
import { initWasm } from "@typeberry/crypto";
import { Blake2b, HASH_SIZE } from "@typeberry/hash";
import { createImporter } from "@typeberry/importer";
import { ImporterReady, importBlockResultCodec } from "@typeberry/importer/state-machine.js";
import { CURRENT_SUITE, CURRENT_VERSION, Result } from "@typeberry/utils";
import { getChainSpec, initializeDatabase, logger, openDatabase } from "./common.js";
import type { JamConfig } from "./jam-config.js";
import type { NodeApi } from "./main.js";
import packageJson from "./package.json" with { type: "json" };

const zeroHash = Bytes.zero(HASH_SIZE).asOpaque();

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

  const workerConfig = new WorkerConfig(chainSpec, dbPath, false);
  const { lmdb, importer } = await createImporter(workerConfig);
  const importerReady = new ImporterReady();
  importerReady.setConfig(workerConfig);
  importerReady.setImporter(importer);
  await importer.prepareForNextEpoch();

  const api: NodeApi = {
    chainSpec,
    async importBlock(block: BlockView) {
      const res = (await importerReady.importBlock(block.encoded().raw)).response;
      if (res !== null && res !== undefined) {
        return Decoder.decodeObject(importBlockResultCodec, res);
      }
      return Result.error("invalid response", () => "Importer: import block response was null or undefined");
    },
    async getStateEntries(hash: HeaderHash) {
      return importer.getStateEntries(hash);
    },
    async getBestStateRootHash() {
      return importer.getBestStateRootHash() ?? zeroHash;
    },
    async close() {
      logger.log`[main] 🛢️ Closing the database`;
      await lmdb.close();
      logger.info`[main] ✅ Done.`;
    },
  };

  return api;
}
