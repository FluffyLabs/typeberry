import fs from "node:fs";
import path from "node:path";
import type { Block } from "@typeberry/block";
import { Block as BlockCodec } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { LmdbBlocks } from "@typeberry/database-lmdb";
import { Blake2b } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import type { JamConfig } from "@typeberry/node";
import { getChainSpec, openDatabase } from "@typeberry/node/common.js";

export async function exportBlocks(jamNodeConfig: JamConfig, outputDir: string, withRelPath: (p: string) => string) {
  const logger = Logger.new(import.meta.filename, "export");

  logger.info`📤 Exporting blocks to ${path.resolve(outputDir)}`;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const blake2b = await Blake2b.createHasher();
  const chainSpec = getChainSpec(jamNodeConfig.node.flavor);
  const { rootDb } = openDatabase(
    blake2b,
    jamNodeConfig.nodeName,
    jamNodeConfig.node.chainSpec.genesisHeader,
    withRelPath(jamNodeConfig.node.databaseBasePath),
    { readOnly: true },
  );

  const blocks = new LmdbBlocks(chainSpec, rootDb);

  const allBlocks: Array<{ block: Block; timeSlot: number }> = [];
  let currentHash = blocks.getBestHeaderHash();

  while (currentHash.isEqualTo(Bytes.zero(32)) !== true) {
    const header = blocks.getHeader(currentHash);
    const extrinsic = blocks.getExtrinsic(currentHash);

    if (header !== null && extrinsic !== null) {
      const timeSlot = header.timeSlotIndex.materialize();
      const block = BlockCodec.create({
        header: header.materialize(),
        extrinsic: extrinsic.materialize(),
      });

      allBlocks.push({
        block,
        timeSlot,
      });

      currentHash = header.parentHeaderHash.materialize();
    } else {
      break;
    }
  }

  allBlocks.sort((a, b) => a.timeSlot - b.timeSlot);

  for (let i = 0; i < allBlocks.length; i++) {
    const { block, timeSlot } = allBlocks[i];
    const filename = `${timeSlot.toString().padStart(8, "0")}.bin`;
    const filepath = path.join(outputDir, filename);

    const encodedBlock = Encoder.encodeObject(BlockCodec.Codec, block, chainSpec);

    fs.writeFileSync(filepath, encodedBlock.raw);
    logger.log`✅ Exported block ${i + 1}/${allBlocks.length}: ${filename}`;
  }

  await rootDb.close();

  logger.info`🫡 Export completed successfully: ${allBlocks.length} blocks exported to ${path.resolve(outputDir)}`;
}
