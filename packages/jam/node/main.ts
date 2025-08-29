import { isMainThread } from "node:worker_threads";
import { Logger } from "@typeberry/logger";

import { Block, type BlockView, Extrinsic, Header, type HeaderHash, type HeaderView } from "@typeberry/block";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { asKnownSize } from "@typeberry/collections";
import { type ChainSpec, WorkerConfig, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { type JipChainSpec, KnownChainSpec } from "@typeberry/config-node";
import { LmdbBlocks, LmdbRoot, LmdbStates } from "@typeberry/database-lmdb";
import type { Finished, MainInit } from "@typeberry/generic-worker";
import { HASH_SIZE, WithHash, blake2b } from "@typeberry/hash";
import * as blockImporter from "@typeberry/importer";
import type { MainReady } from "@typeberry/importer/state-machine.js";
import { NetworkWorkerConfig } from "@typeberry/jam-network/state-machine.js";
import type { Listener, MessageChannelStateMachine } from "@typeberry/state-machine";
import { SerializedState, StateEntries } from "@typeberry/state-merkleization";
import { startBlockGenerator } from "./author.js";
import { initializeExtensions } from "./extensions.js";
import { startNetwork } from "./network.js";
import { startBlocksReader } from "./reader.js";

import type { JamConfig, NetworkConfig } from "./jam-config.js";

export * from "./jam-config.js";

const logger = Logger.new(import.meta.filename, "jam");

export enum DatabaseKind {
  InMemory = 0,
  Lmdb = 1,
}

export async function main(config: JamConfig, withRelPath: (v: string) => string) {
  if (!isMainThread) {
    logger.error("The main binary cannot be running as a Worker!");
    return;
  }

  logger.info(`🎸 Starting node: ${config.nodeName}`);
  const chainSpec = getChainSpec(config.node.flavor);
  const { rootDb, dbPath, genesisHeaderHash } = openDatabase(
    config.nodeName,
    config.node.chainSpec.genesisHeader,
    withRelPath(config.node.databaseBasePath),
  );

  // Initialize the database with genesis state and block if there isn't one.
  await initializeDatabase(chainSpec, genesisHeaderHash, rootDb, config.node.chainSpec);

  // Start extensions
  const importerInit = await blockImporter.spawnWorker();
  const bestHeader = importerInit.getState<MainReady>("ready(main)").onBestBlock;
  const closeExtensions = initializeExtensions({ chainSpec, bestHeader });

  // Start block importer
  const workerConfig = new WorkerConfig(chainSpec, dbPath, config.node.authorship.omitSealVerification);
  const importerReady = importerInit.transition((state, port) => {
    return state.sendConfig(port, workerConfig);
  });

  // Initialize block reader and wait for it to finish
  const blocksReader = initBlocksReader(importerReady, chainSpec, config.blocksToImport);

  // Authorship initialization.
  // 1. load validator keys (bandersnatch, ed25519, bls)
  // 2. allow the validator to specify metadata.
  // 3. if we have validator keys, we should start the authorship module.
  const closeAuthorship = await initAuthorship(
    importerReady,
    config.isAuthoring && config.blocksToImport === null,
    workerConfig,
  );

  // Networking initialization
  const closeNetwork = await initNetwork(
    importerReady,
    workerConfig,
    genesisHeaderHash,
    config.network,
    config.blocksToImport === null,
    bestHeader,
  );

  logger.info("[main]⌛ waiting for importer to finish");
  const importerDone = await blocksReader;
  logger.log("[main] ☠️  Closing the extensions");
  closeExtensions();
  logger.log("[main]⌛ waiting for tasks to finish");
  await importerDone.currentState().waitForWorkerToFinish();
  logger.log("[main] ☠️  Closing the authorship module");
  closeAuthorship();
  logger.log("[main] ☠️  Closing the networking module");
  closeNetwork();

  logger.info("[main] ✅ Done.");
}

type ImporterReady = MessageChannelStateMachine<MainReady, Finished | MainReady | MainInit<MainReady>>;

const initAuthorship = async (importerReady: ImporterReady, isAuthoring: boolean, config: WorkerConfig) => {
  if (!isAuthoring) {
    logger.log("✍️  Authorship off: disabled");
    return () => Promise.resolve();
  }

  logger.info("✍️  Starting block generator.");
  const { generator, finish } = await startBlockGenerator(config);
  // relay blocks from generator to importer
  importerReady.doUntil<Finished>("finished", async (importer, port) => {
    generator.currentState().onBlock.on((b) => {
      logger.log(`✍️  Produced block. Size: [${b.length}]`);
      importer.sendBlock(port, b);
    });
  });

  return finish;
};

const initBlocksReader = async (
  importerReady: ImporterReady,
  chainSpec: ChainSpec,
  blocksToImport: string[] | null,
) => {
  if (blocksToImport === null) {
    return importerReady.waitForState<Finished>("finished");
  }

  logger.info(`📖 Reading ${blocksToImport.length} blocks`);
  return importerReady.transition<Finished>((importer, port) => {
    const reader = startBlocksReader({
      files: blocksToImport,
      chainSpec,
    });
    for (const block of reader) {
      logger.log(`📖 Importing block: #${block.header.view().timeSlotIndex.materialize()}`);
      importer.sendBlock(port, block.encoded().raw);
    }
    // close the importer.
    logger.info("All blocks scheduled to be imported.");
    return importer.finish(port);
  });
};

const initNetwork = async (
  importerReady: ImporterReady,
  workerConfig: WorkerConfig,
  genesisHeaderHash: HeaderHash,
  networkConfig: NetworkConfig | null,
  shouldStartNetwork: boolean,
  bestHeader: Listener<WithHash<HeaderHash, HeaderView>>,
) => {
  if (!shouldStartNetwork || networkConfig === null) {
    logger.log(`🛜 Networking off: ${networkConfig === null ? "no config" : "disabled"}`);
    return () => Promise.resolve();
  }

  const { key, host, port, bootnodes } = networkConfig;

  const { network, finish } = await startNetwork(
    NetworkWorkerConfig.new({
      genericConfig: workerConfig,
      genesisHeaderHash,
      key,
      host,
      port,
      bootnodes: bootnodes.map((node) => node.toString()),
    }),
  );

  // relay blocks from networking to importer?
  importerReady.doUntil("finished", async (importer, port) => {
    network.currentState().onNewBlocks.on((newBlocks) => {
      for (const block of newBlocks) {
        importer.sendBlock(port, block.encoded().raw);
      }
    });
  });

  // relay newly imported headers to trigger network announcements
  network.doUntil("finished", async (network, port) => {
    bestHeader.on((header) => {
      network.announceHeader(port, header);
    });
  });

  return finish;
};

export const getChainSpec = (name: KnownChainSpec) => {
  if (name === KnownChainSpec.Full) {
    return fullChainSpec;
  }

  if (name === KnownChainSpec.Tiny) {
    return tinyChainSpec;
  }

  throw new Error(`Unknown chain spec: ${name}. Possible options: ${[KnownChainSpec.Full, KnownChainSpec.Tiny]}`);
};

export function openDatabase(
  nodeName: string,
  genesisHeader: BytesBlob,
  databaseBasePath: string,
  { readOnly = false }: { readOnly?: boolean } = {},
) {
  const nodeNameHash = blake2b.hashString(nodeName).toString().substring(2, 10);
  const genesisHeaderHash = blake2b.hashBytes(genesisHeader).asOpaque<HeaderHash>();
  const genesisHeaderHashNibbles = genesisHeaderHash.toString().substring(2, 10);

  const dbPath = `${databaseBasePath}/${nodeNameHash}/${genesisHeaderHashNibbles}`;
  logger.info(`🛢️ Opening database at ${dbPath}`);
  try {
    return {
      dbPath,
      rootDb: new LmdbRoot(dbPath, readOnly),
      genesisHeaderHash,
    };
  } catch (e) {
    throw new Error(`Unable to open database at ${dbPath}: ${e}`);
  }
}

/**
 * Initialize the database unless it's already initialized.
 *
 * The function checks the genesis header
 */
async function initializeDatabase(
  spec: ChainSpec,
  genesisHeaderHash: HeaderHash,
  rootDb: LmdbRoot,
  config: JipChainSpec,
): Promise<void> {
  const blocks = new LmdbBlocks(spec, rootDb);
  const states = new LmdbStates(spec, rootDb);

  const header = blocks.getBestHeaderHash();
  const state = blocks.getPostStateRoot(header);
  logger.log(`🛢️ Best header hash: ${header}`);
  logger.log(`🛢️ Best state root: ${state}`);

  // DB seems already initialized, just go with what we have.
  if (state !== null && !state.isEqualTo(Bytes.zero(HASH_SIZE)) && !header.isEqualTo(Bytes.zero(HASH_SIZE))) {
    await rootDb.db.close();
    return;
  }

  logger.log("🛢️ Database looks fresh. Initializing.");
  // looks like a fresh db, initialize the state.
  const genesisHeader = Decoder.decodeObject(Header.Codec, config.genesisHeader, spec);
  const genesisExtrinsic = emptyBlock().extrinsic;
  const genesisBlock = Block.create({ header: genesisHeader, extrinsic: genesisExtrinsic });
  const blockView = Decoder.decodeObject(Block.Codec.View, Encoder.encodeObject(Block.Codec, genesisBlock, spec), spec);
  logger.log(`🧬 Writing genesis block #${genesisHeader.timeSlotIndex}: ${genesisHeaderHash}`);

  const { genesisStateSerialized, genesisStateRootHash } = loadGenesisState(spec, config.genesisState);

  // write to db
  await blocks.insertBlock(new WithHash<HeaderHash, BlockView>(genesisHeaderHash, blockView));
  await states.insertState(genesisHeaderHash, genesisStateSerialized);
  await blocks.setPostStateRoot(genesisHeaderHash, genesisStateRootHash);
  await blocks.setBestHeaderHash(genesisHeaderHash);

  // close the DB
  await rootDb.db.close();
}

function loadGenesisState(spec: ChainSpec, data: JipChainSpec["genesisState"]) {
  const stateEntries = StateEntries.fromEntriesUnsafe(data.entries());
  const state = SerializedState.fromStateEntries(spec, stateEntries);

  const genesisStateRootHash = stateEntries.getRootHash();
  logger.info(`🧬 Genesis state root: ${genesisStateRootHash}`);

  return {
    genesisState: state,
    genesisStateSerialized: stateEntries,
    genesisStateRootHash,
  };
}

function emptyBlock() {
  return Block.create({
    header: Header.empty(),
    extrinsic: Extrinsic.create({
      tickets: asKnownSize([]),
      preimages: [],
      assurances: asKnownSize([]),
      guarantees: asKnownSize([]),
      disputes: {
        verdicts: [],
        culprits: [],
        faults: [],
      },
    }),
  });
}
