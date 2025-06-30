import { isMainThread } from "node:worker_threads";
import { Logger } from "@typeberry/logger";

import { Block, type BlockView, Extrinsic, Header, type HeaderHash, type StateRootHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { asKnownSize } from "@typeberry/collections";
import { type ChainSpec, Config, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { parseBootnode } from "@typeberry/config/net";
import { SEED_SIZE, deriveEd25519SecretKey, trivialSeed } from "@typeberry/crypto/key-derivation.js";
import { LmdbBlocks, LmdbRoot, LmdbStates } from "@typeberry/database-lmdb";
import type { Finished, MainInit } from "@typeberry/generic-worker";
import { HASH_SIZE, WithHash, blake2b } from "@typeberry/hash";
import * as blockImporter from "@typeberry/importer";
import type { MainReady } from "@typeberry/importer/state-machine.js";
import { NetworkConfig } from "@typeberry/jam-network/state-machine.js";
import type { Bootnode } from "@typeberry/jamnp-s";
import { tryAsU32 } from "@typeberry/numbers";
import type { MessageChannelStateMachine } from "@typeberry/state-machine";
import { StateEntries } from "@typeberry/state-merkleization";
import { type Arguments, Command, KnownChainSpec } from "./args.js";
import { startBlockGenerator } from "./author.js";
import { initializeExtensions } from "./extensions.js";
import { loadGenesis, loadGenesisBlock } from "./genesis.js";
import { startNetwork } from "./network.js";
import { startBlocksReader } from "./reader.js";

const logger = Logger.new(import.meta.filename, "jam");

export enum DatabaseKind {
  InMemory = 0,
  Lmdb = 1,
}

/** General options. */
type Options = {
  /** Whether we should be authoring blocks. */
  isAuthoring: boolean;
  /** Paths to JSON or binary blocks to import (ordered). */
  blocksToImport: string[] | null;
  // TODO [ToDr] Remove in favor of JIP-4 config file.
  /** Path to JSON with genesis state. */
  genesisPath: string | null;
  /** Path to a JSON with genesis block. */
  genesisBlockPath: string | null;
  /** Genesis root hash. */
  genesisRoot: StateRootHash;
  /** Genesis header hash to use for networking. */
  genesisHeaderHash: HeaderHash;
  /** Path to database to open. */
  databasePath: string;
  /** Chain spec (could also be filename?) */
  chainSpec: KnownChainSpec;
  /** Networking options. */
  network: NetworkingOptions;
};

type NetworkingOptions = {
  key: string;
  host: string;
  port: number;
  bootnodes: Bootnode[];
};

export async function main(args: Arguments) {
  if (!isMainThread) {
    logger.error("The main binary cannot be running as a Worker!");
    return;
  }

  const portShift = args.command === Command.Dev ? args.args.index : 0;
  const networkingKey = (() => {
    // TODO [ToDr] in the future we should probably read the networking key
    // from some file or a database, since we want it to be consistent between runs.
    // For now, for easier testability, we use a deterministic seed.
    const seed = args.command === Command.Dev ? trivialSeed(tryAsU32(args.args.index)) : Bytes.zero(SEED_SIZE);
    const key = deriveEd25519SecretKey(seed);
    return key;
  })();

  const options: Options = {
    // TODO [ToDr] temporarily disable
    isAuthoring: args.command === Command.Dev && false,
    blocksToImport: args.command === Command.Import ? args.args.files : null,
    genesisPath: args.args.genesis,
    genesisBlockPath: args.args.genesisBlock,
    genesisRoot: args.args.genesisRoot,
    genesisHeaderHash: args.args.genesisHeaderHash,
    databasePath: args.args.dbPath,
    chainSpec: args.args.chainSpec,
    network: {
      key: networkingKey.toString(),
      host: "127.0.0.1",
      port: 12345 + portShift,
      bootnodes: [
        "e3r2oc62zwfj3crnuifuvsxvbtlzetk4o5qyhetkhagsc2fgl2oka@127.0.0.1:40000",
        "eecgwpgwq3noky4ijm4jmvjtmuzv44qvigciusxakq5epnrfj2utb@127.0.0.1:12345",
        "en5ejs5b2tybkfh4ym5vpfh7nynby73xhtfzmazumtvcijpcsz6ma@127.0.0.1:12346",
        "ekwmt37xecoq6a7otkm4ux5gfmm4uwbat4bg5m223shckhaaxdpqa@127.0.0.1:12347",
      ].map(parseBootnode),
    },
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
  const closeAuthorship = await initAuthorship(
    importerReady,
    options.isAuthoring && options.blocksToImport === null,
    config,
  );

  // Networking initialization
  const closeNetwork = await initNetwork(
    importerReady,
    config,
    options.genesisHeaderHash,
    options.network,
    options.blocksToImport === null,
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

const initAuthorship = async (importerReady: ImporterReady, isAuthoring: boolean, config: Config) => {
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

const initNetwork = async (
  importerReady: ImporterReady,
  genericConfig: Config,
  genesisHeaderHash: HeaderHash,
  { key, host, port, bootnodes }: NetworkingOptions,
  shouldStartNetwork: boolean,
) => {
  if (!shouldStartNetwork) {
    return () => Promise.resolve();
  }

  const { network, finish } = await startNetwork(
    NetworkConfig.new({
      genericConfig,
      genesisHeaderHash,
      key,
      host,
      port,
      bootnodes: bootnodes.map((node) => node.toString()),
    }),
  );

  // relay blocks from networking to importer?
  importerReady.doUntil<Finished>("finished", async (importer, port) => {
    network.currentState().onNewBlocks.on((newBlocks) => {
      for (const block of newBlocks) {
        importer.sendBlock(port, block.encoded().raw);
      }
    });
  });

  return finish;
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
  // TODO [ToDr] Instead of using `genesisRootHash` use first 8 nibbles of
  // genesis header hash, similarly to the networking.
  const dbPath = `${databasePath}/${genesisRootHash}`;
  logger.log(`🛢️ Opening database at ${dbPath}`);
  const rootDb = new LmdbRoot(dbPath);
  const blocks = new LmdbBlocks(spec, rootDb);
  const states = new LmdbStates(spec, rootDb);

  const header = blocks.getBestHeaderHash();
  const state = blocks.getPostStateRoot(header);
  logger.log(`🛢️ Best header hash: ${header}`);
  logger.log(`🛢️ Best state root: ${state}`);

  // DB seems already initialized, just go with what we have.
  if (state !== null && !state.isEqualTo(Bytes.zero(HASH_SIZE)) && !header.isEqualTo(Bytes.zero(HASH_SIZE))) {
    await rootDb.db.close();
    return dbPath;
  }

  // we need genesis, since the DB is empty. Let's error out if it's not provided.
  if (maybeGenesis === null) {
    throw new Error(
      `Database is not initialized. Provide path to genesis state yielding root hash: ${genesisRootHash}`,
    );
  }

  const { genesisStateSerialized, genesisStateRootHash } = maybeGenesis;

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
  await states.insertState(genesisHeaderHash, genesisStateSerialized);
  await blocks.setPostStateRoot(genesisHeaderHash, genesisStateRootHash);
  await blocks.setBestHeaderHash(genesisHeaderHash);

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
  const genesisStateSerialized = StateEntries.serializeInMemory(spec, genesisState);
  const genesisStateRootHash = genesisStateSerialized.getRootHash();
  logger.info(`🧬 Genesis state root: ${genesisStateRootHash}`);

  // mismatch between expected state root and the one loaded.
  if (!genesisStateRootHash.isEqualTo(expectedRootHash)) {
    throw new Error(
      `Incorrect genesis loaded. State root mismatch. Expected: ${expectedRootHash}, got: ${genesisStateRootHash}`,
    );
  }

  return {
    genesisState,
    genesisStateSerialized,
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
