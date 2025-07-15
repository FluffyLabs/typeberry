import fs from "node:fs";
import { isMainThread } from "node:worker_threads";
import { Logger } from "@typeberry/logger";

import { Block, type BlockView, Extrinsic, Header, type HeaderHash } from "@typeberry/block";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { asKnownSize } from "@typeberry/collections";
import { type ChainSpec, type JamConfig, WorkerConfig, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { type JipChainSpec, KnownChainSpec, NodeConfiguration } from "@typeberry/config-node";
import { TruncatedHashDictionary } from "@typeberry/database";
import { LmdbBlocks, LmdbRoot, LmdbStates } from "@typeberry/database-lmdb";
import type { Finished, MainInit } from "@typeberry/generic-worker";
import { HASH_SIZE, WithHash, blake2b } from "@typeberry/hash";
import * as blockImporter from "@typeberry/importer";
import type { MainReady } from "@typeberry/importer/state-machine.js";
import { parseFromJson } from "@typeberry/json-parser";
import type { MessageChannelStateMachine } from "@typeberry/state-machine";
import { SerializedState, StateEntries, type StateKey } from "@typeberry/state-merkleization";
import { startBlockGenerator } from "./author.js";
import { initializeExtensions } from "./extensions.js";
import { startBlocksReader } from "./reader.js";

import devConfigJson from "@typeberry/configs/typeberry-dev.json" with { type: "json" };
import { DEV_CONFIG_PATH } from "../jam-cli/args.js";

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
  const closeExtensions = initializeExtensions({ bestHeader });

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
  const closeAuthorship = await initAuthorship(config.isAuthoring, workerConfig, importerReady);

  logger.info("[main]⌛ waiting for importer to finish");
  const importerDone = await blocksReader;
  logger.log("[main] ☠️  Closing the extensions");
  closeExtensions();
  logger.log("[main]⌛ waiting for tasks to finish");
  await importerDone.currentState().waitForWorkerToFinish();
  logger.log("[main] ☠️  Closing the authorship module");
  closeAuthorship();
  logger.info("[main] ✅ Done.");
}

type ImporterReady = MessageChannelStateMachine<MainReady, Finished | MainReady | MainInit<MainReady>>;

const initAuthorship = async (isAuthoring: boolean, config: WorkerConfig, importerReady: ImporterReady) => {
  if (!isAuthoring) {
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
  const stateDict = TruncatedHashDictionary.fromEntries<StateKey, BytesBlob>(Array.from(data.entries()));
  const stateEntries = StateEntries.fromTruncatedDictionaryUnsafe(stateDict);
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

export function loadConfig(configPath: string): NodeConfiguration {
  if (configPath === DEV_CONFIG_PATH) {
    return parseFromJson(devConfigJson, NodeConfiguration.fromJson);
  }

  try {
    const configFile = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(configFile);
    return parseFromJson(parsed, NodeConfiguration.fromJson);
  } catch (e) {
    throw new Error(`Unable to load config file from ${configPath}: ${e}`);
  }
}
