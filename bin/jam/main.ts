import { isMainThread } from "node:worker_threads";
import { Logger } from "@typeberry/logger";

import { Block, type BlockView, Extrinsic, Header, type HeaderHash, type StateRootHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { asKnownSize } from "@typeberry/collections";
import { type ChainSpec, Config, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { LmdbBlocks, LmdbRoot, LmdbStates } from "@typeberry/database-lmdb";
import type { Finished, MainInit } from "@typeberry/generic-worker";
import { HASH_SIZE, WithHash, blake2b } from "@typeberry/hash";
import * as blockImporter from "@typeberry/importer";
import type { MainReady } from "@typeberry/importer/state-machine.js";
import type { MessageChannelStateMachine } from "@typeberry/state-machine";
import { merkelizeState, serializeState } from "@typeberry/state-merkleization";
import { type Arguments, Command, KnownChainSpec } from "./args.js";
import { startBlockGenerator } from "./author.js";
import { initializeExtensions } from "./extensions.js";
import { loadGenesis, loadGenesisBlock } from "./genesis.js";
import { startBlocksReader } from "./reader.js";

const logger = Logger.new(import.meta.filename, "jam");

/** General options. */
type Options = {
  /** Whether we should be authoring blocks. */
  isAuthoring: boolean;
  /** Paths to JSON or binary blocks to import (ordered). */
  blocksToImport: string[] | null;
  /** Path to JSON with genesis state. */
  genesisPath: string | null;
  /** Path to a JSON with genesis block. */
  genesisBlockPath: string | null;
  /** Genesis root hash. */
  genesisRoot: StateRootHash;
  /** Path to database to open. */
  databasePath: string;
  /** Chain spec (could also be filename?) */
  chainSpec: KnownChainSpec;
};

export async function main(args: Arguments) {
  if (!isMainThread) {
    logger.error("The main binary cannot be running as a Worker!");
    return;
  }

  const options: Options = {
    isAuthoring: false,
    blocksToImport: args.command === Command.Import ? args.args.files : null,
    genesisPath: args.args.genesis,
    genesisBlockPath: args.args.genesisBlock,
    genesisRoot: args.args.genesisRoot,
    databasePath: args.args.dbPath,
    chainSpec: KnownChainSpec.Tiny,
  };

  const chainSpec = getChainSpec(options.chainSpec);
  // Initialize the database with genesis state and block if there isn't one.
  const dbPath = await initializeDatabase(
    chainSpec,
    options.databasePath,
    options.genesisRoot,
    options.genesisPath,
    options.genesisBlockPath,
  );

  // Start extensions
  const importerInit = await blockImporter.spawnWorker();
  const bestHeader = importerInit.getState<MainReady>("ready(main)").onBestBlock;
  const closeExtensions = initializeExtensions({ bestHeader });

  // Start block importer
  const config = new Config(chainSpec, dbPath);
  const importerReady = importerInit.transition((state, port) => {
    return state.sendConfig(port, config);
  });

  // Initialize block reader and wait for it to finish
  const blocksReader = initBlocksReader(importerReady, chainSpec, options.blocksToImport);

  // Authorship initialization.
  // 1. load validator keys (bandersnatch, ed25519, bls)
  // 2. allow the validator to specify metadata.
  // 3. if we have validator keys, we should start the authorship module.
  const closeAuthorship = await initAuthorship(options.isAuthoring, config, importerReady);

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

const initAuthorship = async (isAuthoring: boolean, config: Config, importerReady: ImporterReady) => {
  if (!isAuthoring) {
    return () => Promise.resolve();
  }

  logger.info("✍️  Starting block generator.");
  const { generator, finish } = await startBlockGenerator(config);
  // relay blocks from generator to importer
  importerReady.doUntil<Finished>("finished", async (importer, port) => {
    generator.currentState().onBlock.on((b) => {
      logger.log(`✍️  Produced block: ${b.length}`);
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

const getChainSpec = (name: KnownChainSpec) => {
  if (name === KnownChainSpec.Full) {
    return fullChainSpec;
  }

  if (name === KnownChainSpec.Tiny) {
    return tinyChainSpec;
  }

  throw new Error(`Unknown chain spec: ${name}`);
};

/**
 * Initialize the database unless it's already initialized.
 *
 * The function checks the genesis header
 */
async function initializeDatabase(
  spec: ChainSpec,
  databasePath: string,
  genesisRootHash: StateRootHash,
  genesisPath: string | null,
  genesisHeaderPath: string | null,
): Promise<string> {
  const maybeGenesis = loadAndCheckGenesisIfProvided(spec, genesisRootHash, genesisPath);
  const dbPath = `${databasePath}/${genesisRootHash}`;
  logger.log(`🛢️ Opening database at ${dbPath}`);
  const rootDb = new LmdbRoot(dbPath);
  const blocks = new LmdbBlocks(spec, rootDb);
  const states = new LmdbStates(spec, rootDb);

  const [header, state] = blocks.getBestData();
  logger.log(`🛢️ Best header hash: ${header}`);
  logger.log(`🛢️ Best state root: ${state}`);

  // DB seems already initialized, just go with what we have.
  if (!state.isEqualTo(Bytes.zero(HASH_SIZE)) && !header.isEqualTo(Bytes.zero(HASH_SIZE))) {
    await rootDb.db.close();
    return dbPath;
  }

  // we need genesis, since the DB is empty. Let's error out if it's not provided.
  if (maybeGenesis === null) {
    throw new Error(
      `Database is not initialized. Provide path to genesis state yielding root hash: ${genesisRootHash}`,
    );
  }

  const { genesisState, genesisStateRootHash } = maybeGenesis;

  logger.log("🛢️ Database looks fresh. Initializing.");
  // looks like a fresh db, initialize the state.
  let genesisBlock = loadGenesisBlockIfProvided(spec, genesisHeaderPath);
  if (genesisBlock === null) {
    genesisBlock = emptyBlock();
  }

  const genesisHeader = genesisBlock.header;
  const genesisHeaderHash = blake2b.hashBytes(Encoder.encodeObject(Header.Codec, genesisHeader, spec)).asOpaque();
  const blockView = Decoder.decodeObject(Block.Codec.View, Encoder.encodeObject(Block.Codec, genesisBlock, spec), spec);
  logger.log(`🧬 Writing genesis block ${genesisHeaderHash}`);

  // write to db
  await blocks.insertBlock(new WithHash<HeaderHash, BlockView>(genesisHeaderHash, blockView));
  await states.insertFullState(genesisStateRootHash, genesisState);
  await blocks.setPostStateRoot(genesisHeaderHash, genesisStateRootHash);
  await blocks.setBestData(genesisHeaderHash, genesisStateRootHash);

  // close the DB
  await rootDb.db.close();

  return dbPath;
}

function loadGenesisBlockIfProvided(spec: ChainSpec, genesisBlockPath: string | null): Block | null {
  if (genesisBlockPath === null) {
    return null;
  }

  logger.log(`🧬 Loading genesis block from ${genesisBlockPath}`);
  return loadGenesisBlock(spec, genesisBlockPath);
}

function loadAndCheckGenesisIfProvided(spec: ChainSpec, expectedRootHash: StateRootHash, genesisPath: string | null) {
  if (genesisPath === null) {
    return null;
  }

  logger.log(`🧬 Loading genesis state from ${genesisPath}`);
  const genesisState = loadGenesis(spec, genesisPath);
  const genesisStateRootHash = merkelizeState(serializeState(genesisState, spec));
  logger.info(`🧬 Genesis state root: ${genesisStateRootHash}`);

  // mismatch between expected state root and the one loaded.
  if (!genesisStateRootHash.isEqualTo(expectedRootHash)) {
    throw new Error(
      `Incorrect genesis loaded. State root mismatch. Expected: ${expectedRootHash}, got: ${genesisStateRootHash}`,
    );
  }

  return {
    genesisState,
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
