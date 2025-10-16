import { initWasm } from "@typeberry/crypto";
import type { BlocksDb, LeafDb, StatesDb } from "@typeberry/database";
import { Blake2b, keccak, ZERO_HASH } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import type { SerializedState } from "@typeberry/state-merkleization";
import { TransitionHasher } from "@typeberry/transition";
import { Result, resultToString } from "@typeberry/utils";
import type { WorkerConfig } from "@typeberry/workers-api";
import { Importer } from "./importer.js";
import type { ImporterConfig, ImporterInternal } from "./protocol.js";

const logger = Logger.new(import.meta.filename, "importer");
const keccakHasher = keccak.KeccakHasher.create();
const blake2b = Blake2b.createHasher();

type Config = WorkerConfig<ImporterConfig, BlocksDb, StatesDb<SerializedState<LeafDb>>>;

export async function createImporter(config: Config) {
  const chainSpec = config.chainSpec;
  const db = config.openDatabase({ readonly: false });
  const blocks = db.getBlocksDb();
  const states = db.getStatesDb();

  const hasher = new TransitionHasher(chainSpec, await keccakHasher, await blake2b);
  const importer = new Importer(chainSpec, hasher, logger, blocks, states);

  return {
    importer,
    db,
  };
}

/**
 * The `BlockImporter` listens to `block` signals, where it expects
 * RAW undecoded block objects (typically coming from the network).
 *
 * These blocks should be decoded, verified and later imported.
 */
export async function main(config: Config, comms: ImporterInternal) {
  const wasmPromise = initWasm();
  logger.info`📥 Importer starting`;

  const { omitSealVerification } = config.workerParams;
  const { importer, db } = await createImporter(config);

  const finishPromise = new Promise<void>((resolve) => {
    comms.setOnFinish(async () => resolve());
  });

  comms.setOnImportBlock(async (block) => {
    const res = await importer.importBlock(block, omitSealVerification);
    if (res.isError) {
      const errMsg = resultToString(res);
      return Result.error(errMsg, () => errMsg);
    }

    await comms.sendBestHeaderAnnouncement(res.ok);

    return Result.ok(res.ok.hash);
  });

  comms.setOnGetStateEntries(async (headerHash) => {
    return importer.getStateEntries(headerHash);
  });

  comms.setOnGetBestStateRootHash(async () => {
    return importer.getBestStateRootHash() ?? ZERO_HASH.asOpaque();
  });

  await wasmPromise;
  logger.info`📥 Importer waiting for blocks.`;

  // await finish signal
  await finishPromise;
  importer.close();
  logger.info`📥 Importer finished. Closing channel.`;
  await db.close();
  comms.destroy();
  logger.info`📥 Importer 🪦`;
}
