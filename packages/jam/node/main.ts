import { isMainThread } from "node:worker_threads";
import type { BlockView, HeaderHash, HeaderView, StateRootHash } from "@typeberry/block";
import { type ChainSpec, PvmBackend } from "@typeberry/config";
import { initWasm } from "@typeberry/crypto";
import {
  type BandersnatchSecretSeed,
  deriveBandersnatchSecretKey,
  deriveEd25519SecretKey,
  type Ed25519SecretSeed,
  trivialSeed,
} from "@typeberry/crypto/key-derivation.js";
import type { BlocksDb, RootDb, SerializedStatesDb } from "@typeberry/database";
import { Blake2b, type WithHash } from "@typeberry/hash";
import { type ImporterApi, ImporterConfig } from "@typeberry/importer";
import { NetworkingConfig } from "@typeberry/jam-network";
import { Listener } from "@typeberry/listener";
import { tryAsU16, tryAsU32 } from "@typeberry/numbers";
import type { StateEntries } from "@typeberry/state-merkleization";
import type { Telemetry } from "@typeberry/telemetry";
import { CURRENT_SUITE, CURRENT_VERSION, Result } from "@typeberry/utils";
import { DirectWorkerConfig } from "@typeberry/workers-api";
import { InMemWorkerConfig, LmdbWorkerConfig } from "@typeberry/workers-api-node";
import { getChainSpec, getDatabasePath, initializeDatabase, logger } from "./common.js";
import { initializeExtensions } from "./extensions.js";
import type { JamConfig, NetworkConfig } from "./jam-config.js";
import * as metrics from "./metrics.js";
import packageJson from "./package.json" with { type: "json" };
import {
  spawnBlockGeneratorWorker,
  spawnImporterWorker,
  spawnNetworkWorker,
  startBlockGenerator,
  startImporterDirect,
  startNetwork,
} from "./workers.js";

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
  const nodeName = config.nodeName;
  const isInMemory = config.node.databaseBasePath === undefined;

  const { dbPath, genesisHeaderHash } = getDatabasePath(
    blake2b,
    nodeName,
    config.node.chainSpec.genesisHeader,
    withRelPath(config.node.databaseBasePath ?? "<in-memory>"),
  );

  const baseConfig = { nodeName, chainSpec, blake2b, dbPath };

  const workerConfig = isInMemory
    ? InMemWorkerConfig.new({
        ...baseConfig,
        workerParams: ImporterConfig.create({
          pvm: config.pvmBackend,
        }),
      })
    : LmdbWorkerConfig.new({
        ...baseConfig,
        workerParams: ImporterConfig.create({
          pvm: config.pvmBackend,
        }),
      });

  // Initialize the database with genesis state and block if there isn't one.
  logger.info`🛢️ Opening database at ${dbPath}`;
  const rootDb = workerConfig.openDatabase({ readonly: false });
  await initializeDatabase(chainSpec, blake2b, genesisHeaderHash, rootDb, config.node.chainSpec, config.ancestry);
  // NOTE [ToDr] even though, we should be closing the database here,
  // it seems that opening it in the main thread for writing, and later
  // in the importer thread, causes issues. Everything works fine though,
  // if we DO NOT close the database (I guess it's process-shared?)
  // await rootDb.close();

  // Start block importer
  let importer: ImporterApi;
  let closeImporter: () => Promise<void>;

  if (isInMemory) {
    ({ importer, finish: closeImporter } = await startImporterDirect(
      DirectWorkerConfig.new({
        ...workerConfig,
        blocksDb: rootDb.getBlocksDb(),
        statesDb: rootDb.getStatesDb(),
      }),
    ));
  } else {
    if (!(workerConfig instanceof LmdbWorkerConfig)) {
      throw new Error("Expected LmdbWorkerConfig in LMDB mode");
    }
    ({ importer, finish: closeImporter } = await spawnImporterWorker(workerConfig));
  }

  const bestHeader = new Listener<WithHash<HeaderHash, HeaderView>>();
  importer.setOnBestHeaderAnnouncement(async (header) => {
    const slot = header.data.timeSlotIndex.materialize();
    nodeMetrics.recordBestBlockChanged(slot, header.hash.toString());
    await bestHeader.callbackHandler()(header);
  });

  // Start extensions
  const closeExtensions = initializeExtensions({ chainSpec, bestHeader, nodeName });

  // Authorship initialization.
  // 1. load validator keys (bandersnatch, ed25519, bls)
  // 2. allow the validator to specify metadata.
  // 3. if we have validator keys, we should start the authorship module.
  // NOTE: use trivialSeed to derive validator keys is safe
  // because the authorship keys are only initialized when devValidatorIndex is specified (development mode),
  // and trivial seeds are appropriate for test validators as defined in JIP-5.
  const validatorIndex = config.devValidatorIndex ?? "all";
  const authorshipKeys = {
    keys:
      validatorIndex === "all"
        ? Array.from({ length: chainSpec.validatorsCount })
            .map((_, i) => trivialSeed(tryAsU32(i)))
            .map((seed) => ({
              bandersnatch: deriveBandersnatchSecretKey(seed, blake2b),
              ed25519: deriveEd25519SecretKey(seed, blake2b),
            }))
        : [
            {
              bandersnatch: deriveBandersnatchSecretKey(trivialSeed(tryAsU32(validatorIndex)), blake2b),
              ed25519: deriveEd25519SecretKey(trivialSeed(tryAsU32(validatorIndex)), blake2b),
            },
          ],
  };

  const closeAuthorship = await initAuthorship(
    importer,
    config.isAuthoring,
    rootDb,
    baseConfig,
    authorshipKeys,
    isInMemory,
  );

  // Networking initialization
  const closeNetwork = await initNetwork(
    importer,
    rootDb,
    baseConfig,
    genesisHeaderHash,
    config.network,
    bestHeader,
    isInMemory,
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
  rootDb: RootDb<BlocksDb, SerializedStatesDb>,
  baseConfig: {
    nodeName: string;
    chainSpec: ChainSpec;
    blake2b: Blake2b;
    dbPath: string;
  },
  authorshipKeys: { keys: { bandersnatch: BandersnatchSecretSeed; ed25519: Ed25519SecretSeed }[] },
  isInMemory: boolean,
) => {
  if (!isAuthoring) {
    logger.log`✍️  Authorship off: disabled`;
    return () => Promise.resolve();
  }

  logger.info`✍️  Starting block generator.`;
  const { generator, finish } = isInMemory
    ? await startBlockGenerator(
        DirectWorkerConfig.new({
          nodeName: baseConfig.nodeName,
          chainSpec: baseConfig.chainSpec,
          blocksDb: rootDb.getBlocksDb(),
          statesDb: rootDb.getStatesDb(),
          workerParams: authorshipKeys,
        }),
      )
    : await spawnBlockGeneratorWorker(
        LmdbWorkerConfig.new({
          ...baseConfig,
          workerParams: authorshipKeys,
        }),
      );

  // relay blocks from generator to importer
  generator.setOnBlock(async (block) => {
    logger.log`✍️  Produced block at ${block.header.view().timeSlotIndex.materialize()}`;
    await importer.sendImportBlock(block);
  });

  return finish;
};

const initNetwork = async (
  importer: ImporterApi,
  rootDb: RootDb<BlocksDb, SerializedStatesDb>,
  baseConfig: {
    nodeName: string;
    chainSpec: ChainSpec;
    blake2b: Blake2b;
    dbPath: string;
  },
  genesisHeaderHash: HeaderHash,
  networkConfig: NetworkConfig | null,
  bestHeader: Listener<WithHash<HeaderHash, HeaderView>>,
  isInMemory: boolean,
) => {
  if (networkConfig === null) {
    logger.log`🛜 Networking off: no config`;
    return () => Promise.resolve();
  }

  const { key, host, port, bootnodes } = networkConfig;

  const networkingConfig = NetworkingConfig.create({
    genesisHeaderHash,
    key,
    host,
    port: tryAsU16(port),
    bootnodes: bootnodes.map((node) => node.toString()),
  });

  const { network, finish } = isInMemory
    ? await startNetwork(
        DirectWorkerConfig.new({
          nodeName: baseConfig.nodeName,
          chainSpec: baseConfig.chainSpec,
          blocksDb: rootDb.getBlocksDb(),
          statesDb: rootDb.getStatesDb(),
          workerParams: networkingConfig,
        }),
      )
    : await spawnNetworkWorker(
        LmdbWorkerConfig.new({
          ...baseConfig,
          workerParams: networkingConfig,
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
