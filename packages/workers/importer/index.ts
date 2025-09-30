import { isMainThread, parentPort } from "node:worker_threads";
import type { WorkerConfig } from "@typeberry/config";
import { initWasm } from "@typeberry/crypto";
import { LmdbBlocks, LmdbRoot, LmdbStates } from "@typeberry/database-lmdb";
import type { Finished } from "@typeberry/generic-worker";
import { Blake2b, keccak } from "@typeberry/hash";
import { Level, Logger } from "@typeberry/logger";
import { MessageChannelStateMachine } from "@typeberry/state-machine";
import { TransitionHasher } from "@typeberry/transition";
import { Importer } from "./importer.js";
import { type ImporterInit, type ImporterReady, type ImporterStates, importerStateMachine } from "./state-machine.js";

const logger = Logger.new(import.meta.filename, "importer");

if (!isMainThread) {
  Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
  const machine = importerStateMachine();
  const channel = MessageChannelStateMachine.receiveChannel(machine, parentPort);
  channel.then((channel) => main(channel)).catch((e) => logger.error`${e}`);
}

const keccakHasher = keccak.KeccakHasher.create();
const blake2b = Blake2b.createHasher();

export async function createImporter(config: WorkerConfig) {
  const lmdb = new LmdbRoot(config.dbPath);
  const blocks = new LmdbBlocks(config.chainSpec, lmdb);
  const states = new LmdbStates(config.chainSpec, lmdb);
  const hasher = new TransitionHasher(config.chainSpec, await keccakHasher, await blake2b);
  const importer = new Importer(config.chainSpec, hasher, logger, blocks, states);
  return {
    lmdb,
    importer,
  };
}

/**
 * The `BlockImporter` listens to `block` signals, where it expects
 * RAW undecoded block objects (typically coming from the network).
 *
 * These blocks should be decoded, verified and later imported.
 */
export async function main(channel: MessageChannelStateMachine<ImporterInit, ImporterStates>) {
  const wasmPromise = initWasm();
  logger.info`📥 Importer starting ${channel.currentState()}`;
  // Await the configuration object
  const ready = await channel.waitForState<ImporterReady>("ready(importer)");
  let closeDb = async () => {};

  const finished = await ready.doUntil<Finished>("finished", async (worker, port) => {
    const config = worker.getConfig();
    const { lmdb, importer } = await createImporter(config);
    closeDb = async () => {
      await lmdb.close();
    };
    // TODO [ToDr] this is shit, since we have circular dependency.
    worker.setImporter(importer);
    logger.info`📥 Importer waiting for blocks.`;

    worker.onBlock.on(async (block) => {
      const res = await importer.importBlock(block, config.omitSealVerification);
      if (res.isOk) {
        worker.announce(port, res.ok);
      }
    });

    await wasmPromise;
  });

  logger.info`📥 Importer finished. Closing channel.`;
  // close the database
  await closeDb();
  // Close the comms to gracefuly close the app.
  finished.currentState().close(channel);
}
