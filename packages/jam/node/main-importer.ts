import {initWasm} from "@typeberry/crypto";
import {JamConfig} from "./jam-config.js";
import {NodeApi} from "./main.js";
import {getChainSpec, initializeDatabase, logger, openDatabase} from "./common.js";
import packageJson from "./package.json" with { type: "json" };
import {CURRENT_SUITE, CURRENT_VERSION, Result} from "@typeberry/utils";
import {createImporter} from "@typeberry/importer";
import {WorkerConfig} from "@typeberry/config";
import {importBlockResultCodec, ImporterReady, MainReady} from "@typeberry/importer/state-machine.js";
import {BlockView, HeaderHash} from "@typeberry/block";
import {Decoder} from "@typeberry/codec";
import {HASH_SIZE} from "@typeberry/hash";
import {Bytes} from "@typeberry/bytes";

const zeroHash = Bytes.zero(HASH_SIZE).asOpaque();

export async function mainImporter(config: JamConfig, withRelPath: (v: string) => string): Promise<NodeApi> {
  await initWasm();

  logger.info(`🫐 Typeberry ${packageJson.version}. GP: ${CURRENT_VERSION} (${CURRENT_SUITE})`);
  logger.info(`🎸 Starting importer: ${config.nodeName}.`);
  const chainSpec = getChainSpec(config.node.flavor);
  const { rootDb, dbPath, genesisHeaderHash } = openDatabase(
    config.nodeName,
    config.node.chainSpec.genesisHeader,
    withRelPath(config.node.databaseBasePath),
  );

  // Initialize the database with genesis state and block if there isn't one.
  await initializeDatabase(chainSpec, genesisHeaderHash, rootDb, config.node.chainSpec, config.ancestry);

  const { importer }= await createImporter(new WorkerConfig(
    chainSpec,
    dbPath,
    false,
  ));
  const importerReady = new ImporterReady();
  importerReady.setImporter(importer);

  const api: NodeApi = {
    chainSpec,
    async importBlock(block: BlockView) {
      const res = (await importerReady.importBlock(block.encoded().raw)).response;
      if (res !== null && res !== undefined) {
        return Decoder.decodeObject(importBlockResultCodec, res)
      }
      return Result.error("");
    },
    async getStateEntries(hash: HeaderHash) {
      return importer.getStateEntries(hash);
    },
    async getBestStateRootHash() {
      return importer.getBestStateRootHash() ?? zeroHash;
    },
    async close() {
      logger.log("[main] 🛢️ Closing the database");
      await rootDb.close();
      logger.info("[main] ✅ Done.");
    },
  };

  return api;
}
