import { setTimeout } from "node:timers/promises";
import { Blake2b, keccak } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import type { WorkerConfig } from "@typeberry/workers-api";
import { Generator } from "./generator.js";
import type { GeneratorInternal } from "./protocol.js";

const logger = Logger.new(import.meta.filename, "blockgen");

/**
 * The `BlockGenerator` should periodically create new blocks and send them as signals to the main thread.
 */
export async function main(config: WorkerConfig, comms: GeneratorInternal) {
  logger.info`🎁 Block Generator running`;
  const chainSpec = config.chainSpec;
  const db = config.openDatabase();
  const blocks = db.getBlocksDb();
  const states = db.getStatesDb();

  let isFinished = false;
  comms.setOnFinish(async () => {
    isFinished = true;
  });

  // Generate blocks until the close signal is received.
  let counter = 0;
  const generator = new Generator(
    chainSpec,
    await keccak.KeccakHasher.create(),
    await Blake2b.createHasher(),
    blocks,
    states,
  );
  while (!isFinished) {
    await setTimeout(chainSpec.slotDuration * 1000);
    counter += 1;
    const newBlock = await generator.nextBlockView();
    logger.trace`Sending block ${counter}`;
    await comms.sendBlock(newBlock);
  }

  logger.info`🎁 Block Generator finished. Closing channel.`;
  await db.close();
}
