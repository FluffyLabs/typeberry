import fs from "node:fs";
import path from "node:path";
import type { HeaderHash } from "@typeberry/block";
import { Block as BlockCodec } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { Blake2b, HASH_SIZE } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { LmdbWorkerConfig } from "@typeberry/workers-api-node";
import { getChainSpec, getDatabasePath } from "./common.js";
import type { JamConfig } from "./jam-config.js";

export async function exportBlocks(jamNodeConfig: JamConfig, output: string, withRelPath: (p: string) => string) {
  const logger = Logger.new(import.meta.filename, "export");
  const concat = output.endsWith(".bin");

  if (concat) {
    logger.info`📤 Exporting blocks to ${output} (concatenated)`;

    if (fs.existsSync(output)) {
      fs.unlinkSync(output);
    }
  } else {
    logger.info`📤 Exporting blocks to ${output}`;

    if (!fs.existsSync(output)) {
      fs.mkdirSync(output, { recursive: true });
    }
  }

  if (jamNodeConfig.node.databaseBasePath === undefined) {
    logger.info`📖 Running with in-memory database. Nothing to do...`;
    return;
  }

  const blake2b = await Blake2b.createHasher();
  const chainSpec = getChainSpec(jamNodeConfig.node.flavor);
  const { dbPath } = getDatabasePath(
    blake2b,
    jamNodeConfig.nodeName,
    jamNodeConfig.node.chainSpec.genesisHeader,
    withRelPath(jamNodeConfig.node.databaseBasePath),
  );
  const config = LmdbWorkerConfig.new({
    chainSpec,
    blake2b,
    dbPath,
    workerParams: undefined,
  });

  const rootDb = config.openDatabase();
  const blocks = rootDb.getBlocksDb();

  logger.info`📖 Gathering blocks...`;

  const hashes: HeaderHash[] = [];
  let currentHash = blocks.getBestHeaderHash();

  while (currentHash.isEqualTo(Bytes.zero(HASH_SIZE)) !== true) {
    const header = blocks.getHeader(currentHash);

    if (header !== null) {
      hashes.push(currentHash);
      currentHash = header.parentHeaderHash.materialize();
    } else {
      break;
    }
  }

  // reverse to export in chronological order
  hashes.reverse();

  logger.info`📕 ${hashes.length} blocks gathered.`;

  for (let i = 0; i < hashes.length; i++) {
    const header = blocks.getHeader(hashes[i]);
    const extrinsic = blocks.getExtrinsic(hashes[i]);

    if (header === null || extrinsic === null) {
      throw new Error(`❌ Block ${currentHash} could not be read from the database.`);
    }

    const block = BlockCodec.create({
      header: header.materialize(),
      extrinsic: extrinsic.materialize(),
    });
    const encodedBlock = Encoder.encodeObject(BlockCodec.Codec, block, chainSpec);

    if (concat) {
      fs.appendFileSync(output, encodedBlock.raw);
      logger.log`✅ Exported block ${i + 1}/${hashes.length}`;
    } else {
      const filename = `${header.timeSlotIndex.materialize().toString().padStart(8, "0")}.bin`;
      const filepath = path.join(output, filename);
      fs.writeFileSync(filepath, encodedBlock.raw);
      logger.log`✅ Exported block ${i + 1}/${hashes.length}: ${filename}`;
    }
  }

  await rootDb.close();

  logger.info`🫡 Export completed successfully: ${hashes.length} blocks exported to ${output}`;
}
