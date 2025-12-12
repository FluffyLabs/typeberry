import { isMainThread } from "node:worker_threads";
import type { BlockView, HeaderHash, HeaderView, StateRootHash } from "@typeberry/block";
import type { BlockAuthorshipConfig } from "@typeberry/block-authorship";
import { type ChainSpec, PvmBackend } from "@typeberry/config";
import { initWasm } from "@typeberry/crypto";
import { deriveBandersnatchSecretKey, deriveEd25519SecretKey, trivialSeed } from "@typeberry/crypto/key-derivation.js";
import { Blake2b, type WithHash } from "@typeberry/hash";
import { type ImporterApi, ImporterConfig } from "@typeberry/importer";
import { NetworkingConfig } from "@typeberry/jam-network";
import { Listener } from "@typeberry/listener";
import { tryAsU16, tryAsU32 } from "@typeberry/numbers";
import type { StateEntries } from "@typeberry/state-merkleization";
import type { Telemetry } from "@typeberry/telemetry";
import { CURRENT_SUITE, CURRENT_VERSION, Result } from "@typeberry/utils";
import { LmdbWorkerConfig } from "@typeberry/workers-api-node";
import { getChainSpec, getDatabasePath, initializeDatabase, logger } from "./common.js";
import { initializeExtensions } from "./extensions.js";
import type { JamConfig, NetworkConfig } from "./jam-config.js";
import * as metrics from "./metrics.js";
import packageJson from "./package.json" with { type: "json" };
import { spawnBlockGeneratorWorker, spawnImporterWorker, spawnNetworkWorker } from "./workers.js";

export type NodeApi = {
  chainSpec: ChainSpec;
  getStateEntries(hash: HeaderHash): Promise<StateEntries | null>;
  importBlock(block: BlockView): Promise<Result<StateRootHash, string>>;
  getBestStateRootHash(): Promise<StateRootHash>;
  close(): Promise<void>;
};

export async function main(
  config: JamConfig,
  withRelPath: (v: string) => string,
  telemetry: Telemetry | null,
): Promise<NodeApi> {
  if (!isMainThread) {
    throw new Error("The main binary cannot be running as a Worker!");
  }

  await initWasm();

  const nodeMetrics = metrics.createMetrics();

  logger.info`🫐 Typeberry ${packageJson.version}. GP: ${CURRENT_VERSION} (${CURRENT_SUITE})`;
  logger.info`🎸 Starting node: ${config.nodeName}.`;
  logger.info`🖥️ PVM Backend: ${PvmBackend[config.pvmBackend]}.`;
  const chainSpec = getChainSpec(config.node.flavor);
  const blake2b = await Blake2b.createHasher();
  if (config.node.databaseBasePath === undefined) {
    throw new Error("Running with in-memory database is not supported yet.");
  }

  const { dbPath, genesisHeaderHash } = getDatabasePath(
    blake2b,
    config.nodeName,
    config.node.chainSpec.genesisHeader,
    withRelPath(config.node.databaseBasePath),
  );

  const baseConfig = { nodeName: config.nodeName, chainSpec, blake2b, dbPath };
  const importerConfig = LmdbWorkerConfig.new({
    ...baseConfig,
    workerParams: ImporterConfig.create({
      pvm: config.pvmBackend,
      omitSealVerification: config.node.authorship.omitSealVerification,
    }),
  });

  // Initialize the database with genesis state and block if there isn't one.
  logger.info`🛢️ Opening database at ${dbPath}`;
  const rootDb = importerConfig.openDatabase({ readonly: false });
  await initializeDatabase(chainSpec, blake2b, genesisHeaderHash, rootDb, config.node.chainSpec, config.ancestry);
  // NOTE [ToDr] even though, we should be closing the database here,
  // it seems that opening it in the main thread for writing, and later
  // in the importer thread, causes issues. Everything works fine though,
  // if we DO NOT close the database (I guess it's process-shared?)
  // await rootDb.close();

  // Start block importer
  const { importer, finish: closeImporter } = await spawnImporterWorker(importerConfig);
  const bestHeader = new Listener<WithHash<HeaderHash, HeaderView>>();
  importer.setOnBestHeaderAnnouncement(async (header) => {
    const slot = header.data.timeSlotIndex.materialize();
    nodeMetrics.recordBestBlockChanged(slot, header.hash.toString());
    await bestHeader.callbackHandler()(header);
  });

  // Start extensions
  const closeExtensions = initializeExtensions({ chainSpec, bestHeader, nodeName: config.nodeName });

  // Authorship initialization.
  // 1. load validator keys (bandersnatch, ed25519, bls)
  // 2. allow the validator to specify metadata.
  // 3. if we have validator keys, we should start the authorship module.
  const maybeIndex = config.nodeName.split("-").reverse()[0];
  const index = maybeIndex === "all" ? maybeIndex : Number.parseInt(maybeIndex, 10);

  const closeAuthorship = await initAuthorship(
    importer,
    config.isAuthoring,
    LmdbWorkerConfig.new({
      ...baseConfig,
      workerParams: {
        keys:
          index === "all"
            ? Array.from({ length: chainSpec.validatorsCount })
                .map((_, i) => trivialSeed(tryAsU32(i)))
                .map((seed) => ({
                  bandersnatch: deriveBandersnatchSecretKey(seed, blake2b),
                  ed25519: deriveEd25519SecretKey(seed, blake2b),
                }))
            : [
                {
                  bandersnatch: deriveBandersnatchSecretKey(trivialSeed(tryAsU32(index)), blake2b),
                  ed25519: deriveEd25519SecretKey(trivialSeed(tryAsU32(index)), blake2b),
                },
              ],
      },
    }),
  );

  // Networking initialization
  const closeNetwork = await initNetwork(
    importer,
    LmdbWorkerConfig.new({ ...baseConfig, workerParams: undefined }),
    genesisHeaderHash,
    config.network,
    bestHeader,
  );

  const api: NodeApi = {
    chainSpec,
    async importBlock(block: BlockView) {
      const res = await importer.sendImportBlock(block);
      if (res.isOk) {
        return Result.ok(await importer.sendGetBestStateRootHash());
      }
      return res;
    },
    async getStateEntries(hash: HeaderHash) {
      return importer.sendGetStateEntries(hash);
    },
    async getBestStateRootHash() {
      return importer.sendGetBestStateRootHash();
    },
    async close() {
      logger.log`[main] ☠️ Closing the importer`;
      await closeImporter();
      logger.log`[main] ☠️  Closing the extensions`;
      closeExtensions();
      logger.log`[main] ☠️  Closing the authorship module`;
      await closeAuthorship();
      logger.log`[main] ☠️  Closing the networking module`;
      await closeNetwork();
      logger.log`[main] 🛢️ Closing the database`;
      await rootDb.close();
      logger.log`[main] 📳 Closing telemetry`;
      await telemetry?.close();
      logger.info`[main] ✅ Done.`;
    },
  };

  return api;
}

const initAuthorship = async (
  importer: ImporterApi,
  isAuthoring: boolean,
  config: LmdbWorkerConfig<BlockAuthorshipConfig>,
) => {
  if (!isAuthoring) {
    logger.log`✍️  Authorship off: disabled`;
    return () => Promise.resolve();
  }

  logger.info`✍️  Starting block generator.`;
  const { generator, finish } = await spawnBlockGeneratorWorker(config);

  // relay blocks from generator to importer
  generator.setOnBlock(async (block) => {
    logger.log`✍️  Produced block at ${block.header.view().timeSlotIndex.materialize()}`;
    await importer.sendImportBlock(block);
  });

  return finish;
};

const initNetwork = async (
  importer: ImporterApi,
  baseConfig: LmdbWorkerConfig,
  genesisHeaderHash: HeaderHash,
  networkConfig: NetworkConfig | null,
  bestHeader: Listener<WithHash<HeaderHash, HeaderView>>,
) => {
  if (networkConfig === null) {
    logger.log`🛜 Networking off: no config`;
    return () => Promise.resolve();
  }

  const { key, host, port, bootnodes } = networkConfig;

  const { network, finish } = await spawnNetworkWorker(
    LmdbWorkerConfig.new({
      ...baseConfig,
      workerParams: NetworkingConfig.create({
        genesisHeaderHash,
        key,
        host,
        port: tryAsU16(port),
        bootnodes: bootnodes.map((node) => node.toString()),
      }),
    }),
  );

  // relay blocks from networking to importer
  network.setOnBlocks(async (newBlocks) => {
    for (const block of newBlocks) {
      await importer.sendImportBlock(block);
    }
  });

  // relay newly imported headers to trigger network announcements
  bestHeader.on((header) => {
    network.sendNewHeader(header);
  });

  return finish;
};
