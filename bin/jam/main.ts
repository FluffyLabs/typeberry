import fs from "node:fs";
import { isMainThread } from "node:worker_threads";
import { Logger } from "@typeberry/logger";

import { Block, type BlockView, Extrinsic, Header, type HeaderHash } from "@typeberry/block";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { asKnownSize } from "@typeberry/collections";
import { type ChainSpec, Config, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { type JipChainSpec, KnownChainSpec, NodeConfiguration } from "@typeberry/config-node";
import { SEED_SIZE, deriveEd25519SecretKey, trivialSeed } from "@typeberry/crypto/key-derivation.js";
import { TruncatedHashDictionary } from "@typeberry/database";
import { LmdbBlocks, LmdbRoot, LmdbStates } from "@typeberry/database-lmdb";
import type { Finished, MainInit } from "@typeberry/generic-worker";
import { HASH_SIZE, WithHash, blake2b } from "@typeberry/hash";
import * as blockImporter from "@typeberry/importer";
import type { MainReady } from "@typeberry/importer/state-machine.js";
import { NetworkConfig } from "@typeberry/jam-network/state-machine.js";
import type { Bootnode } from "@typeberry/jamnp-s";
import { parseFromJson } from "@typeberry/json-parser";
import { tryAsU32 } from "@typeberry/numbers";
import type { MessageChannelStateMachine } from "@typeberry/state-machine";
import { SerializedState, StateEntries, type StateKey } from "@typeberry/state-merkleization";
import { type Arguments, Command, DEV_CONFIG } from "./args.js";
import { startBlockGenerator } from "./author.js";
import { initializeExtensions } from "./extensions.js";
import { startNetwork } from "./network.js";
import { startBlocksReader } from "./reader.js";

import devConfigJson from "@typeberry/configs/typeberry-dev.json" with { type: "json" };

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
  /** Node name. */
  nodeName: string;
  /** Node configuration. */
  config: NodeConfiguration;
  /** Networking options. */
  network: NetworkingOptions;
};

type NetworkingOptions = {
  key: string;
  host: string;
  port: number;
  bootnodes: Bootnode[];
};

export async function main(args: Arguments, withRelPath: (v: string) => string) {
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

  const nodeConfig = loadConfig(args.args.configPath);
  const options: Options = {
    isAuthoring: args.command === Command.Dev,
    blocksToImport: args.command === Command.Import ? args.args.files : null,
    nodeName: args.args.nodeName,
    config: nodeConfig,
    network: {
      key: networkingKey.toString(),
      host: "127.0.0.1",
      port: 12345 + portShift,
      bootnodes: nodeConfig.chainSpec.bootnodes ?? [],
    },
  };

  const chainSpec = getChainSpec(options.config.flavor);
  const { rootDb, dbPath, genesisHeaderHash } = openDatabase(
    options.nodeName,
    options.config.chainSpec.genesisHeader,
    withRelPath(options.config.databaseBasePath),
  );
  // Initialize the database with genesis state and block if there isn't one.
  await initializeDatabase(chainSpec, genesisHeaderHash, rootDb, options.config.chainSpec);

  // Start extensions
  const importerInit = await blockImporter.spawnWorker();
  const bestHeader = importerInit.getState<MainReady>("ready(main)").onBestBlock;
  const closeExtensions = initializeExtensions({ bestHeader });

  // Start block importer
  const config = new Config(chainSpec, dbPath, options.config.authorship.omitSealVerification);
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
    genesisHeaderHash,
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
  if (configPath === DEV_CONFIG) {
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
