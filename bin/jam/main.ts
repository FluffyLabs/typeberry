import { isMainThread } from "node:worker_threads";
import { Logger } from "@typeberry/logger";

import { Block, type BlockView, Extrinsic, Header, type HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { asKnownSize } from "@typeberry/collections";
import { type ChainSpec, Config, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { LmdbBlocks, LmdbRoot, LmdbStates } from "@typeberry/database-lmdb";
import type { Finished, MainInit } from "@typeberry/generic-worker";
import { HASH_SIZE, WithHash, blake2b } from "@typeberry/hash";
import * as blockImporter from "@typeberry/importer";
import type { MainReady } from "@typeberry/importer/state-machine";
import type { MessageChannelStateMachine } from "@typeberry/state-machine";
import { merkelizeState, serializeState } from "@typeberry/state-merkleization";
import { type Arguments, Command, KnownChainSpec } from "./args";
import { startBlockGenerator } from "./author";
import { initializeExtensions } from "./extensions";
import { loadGenesis } from "./genesis";
import { startBlocksReader } from "./reader";

const logger = Logger.new(__filename, "jam");

/** General options. */
type Options = {
  /** Whether we should be authoring blocks. */
  isAuthoring: boolean;
  /** Paths to JSON or binary blocks to import (ordered). */
  blocksToImport: string[] | null;
  /** Path to JSON with genesis state. */
  genesisPath: string | null;
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
    databasePath: args.args.dbPath,
    chainSpec: KnownChainSpec.Tiny,
  };

  const chainSpec = getChainSpec(options.chainSpec);
  // Initialize the database with genesis state and block if there isn't one.
  const dbPath = await initializeDatabase(chainSpec, options.genesisPath, options.databasePath);

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
  await initBlocksReader(importerReady, chainSpec, options.blocksToImport);

  // Authorship initialization.
  // 1. load validator keys (bandersnatch, ed25519, bls)
  // 2. allow the validator to specify metadata.
  // 3. if we have validator keys, we should start the authorship module.
  const closeAuthorship = await initAuthorship(options.isAuthoring, config, importerReady);

  // start regular operation
  const whenImporterDone = importerReady.doUntil<Finished>("finished", async () => {});

  logger.log("[main]⌛ waiting for tasks to finish");
  const importerDone = await whenImporterDone;
  await importerDone.currentState().waitForWorkerToFinish();
  logger.log("[main] ☠️  Closing the authorship module");
  closeAuthorship();
  logger.log("[main] ☠️  Closing the extensions");
  closeExtensions();
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
    return Promise.resolve();
  }

  logger.info(`📖 Reading ${blocksToImport.length} blocks`);
  return new Promise((resolve, reject) => {
    importerReady.doUntil<Finished>("finished", async (importer, port) => {
      try {
        const reader = startBlocksReader({
          files: blocksToImport,
          chainSpec,
        });
        for (const block of reader) {
          logger.log(`📖 Importing block: #${block.header.view().timeSlotIndex.materialize()}`);
          importer.sendBlock(port, block.encoded().raw);
        }
        return resolve(null);
      } catch (e) {
        return reject(e);
      }
    });
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

async function initializeDatabase(spec: ChainSpec, genesisPath: string | null, databasePath: string): Promise<string> {
  if (genesisPath === null) {
    throw new Error("Genesis path is temporarily required. Provide a path to the genesis state.");
  }
  const genesisState = loadGenesis(spec, genesisPath);
  const genesisStateHash = merkelizeState(serializeState(genesisState, spec));

  const dbPath = `${databasePath}/${genesisStateHash}`;
  const rootDb = new LmdbRoot(dbPath);
  const blocks = new LmdbBlocks(spec, rootDb);
  const states = new LmdbStates(spec, rootDb);

  const [header, state] = blocks.getBestData();
  // DB seems already initialized, just go with what we have.
  if (!state.isEqualTo(Bytes.zero(HASH_SIZE)) && !header.isEqualTo(Bytes.zero(HASH_SIZE))) {
    return dbPath;
  }
  // looks like a fresh db, initialize the state.
  const genesisHeader = Header.empty();
  const genesisHeaderHash = blake2b.hashBytes(Encoder.encodeObject(Header.Codec, genesisHeader, spec)).asOpaque();
  const genesisBlock = new Block(
    genesisHeader,
    Extrinsic.fromCodec({
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
  );
  const blockView = Decoder.decodeObject(Block.Codec.View, Encoder.encodeObject(Block.Codec, genesisBlock, spec), spec);

  // write to db
  await blocks.insertBlock(new WithHash<HeaderHash, BlockView>(genesisHeaderHash, blockView));
  await states.insertFullState(genesisStateHash, genesisState);
  await blocks.setBestData(genesisHeaderHash, genesisStateHash);

  // close the DB
  await rootDb.db.close();

  return dbPath;
}
