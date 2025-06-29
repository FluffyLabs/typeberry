import { promises as fs } from "node:fs";
import path from "node:path";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { Command, KnownChainSpec, main as jam } from "@typeberry/jam";
import { Level, Logger } from "@typeberry/logger";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);

export const DB_PATH = "./database";
export const GENESIS_ROOT = "c07cdbce686c64d0a9b6539c70b0bb821b6a74d9de750a46a5da05b5640c290a";

async function main() {
  const dbDirStat = await fs.stat(path.join(DB_PATH, `0x${GENESIS_ROOT}`)).catch(() => null);

  if (dbDirStat === null || !dbDirStat.isDirectory()) {
    await jam({
      command: Command.Import,
      args: {
        files: [
          "../../jamdunavectors/data/safrole/blocks/1_000.json",
          "../../jamdunavectors/data/safrole/blocks/1_001.json",
          "../../jamdunavectors/data/safrole/blocks/1_002.json",
          "../../jamdunavectors/data/safrole/blocks/1_003.json",
          "../../jamdunavectors/data/safrole/blocks/1_004.json",
          "../../jamdunavectors/data/safrole/blocks/1_005.json",
          "../../jamdunavectors/data/safrole/blocks/1_006.json",
          "../../jamdunavectors/data/safrole/blocks/1_007.json",
          "../../jamdunavectors/data/safrole/blocks/1_008.json",
          "../../jamdunavectors/data/safrole/blocks/1_009.json",
          "../../jamdunavectors/data/safrole/blocks/1_010.json",
          "../../jamdunavectors/data/safrole/blocks/1_011.json",
          "../../jamdunavectors/data/safrole/blocks/2_000.json",
          "../../jamdunavectors/data/safrole/blocks/2_001.json",
          "../../jamdunavectors/data/safrole/blocks/2_002.json",
          "../../jamdunavectors/data/safrole/blocks/2_003.json",
          "../../jamdunavectors/data/safrole/blocks/2_004.json",
          "../../jamdunavectors/data/safrole/blocks/2_005.json",
          "../../jamdunavectors/data/safrole/blocks/2_006.json",
          "../../jamdunavectors/data/safrole/blocks/2_007.json",
          "../../jamdunavectors/data/safrole/blocks/2_008.json",
          "../../jamdunavectors/data/safrole/blocks/2_009.json",
          "../../jamdunavectors/data/safrole/blocks/2_010.json",
          "../../jamdunavectors/data/safrole/blocks/2_011.json",
          "../../jamdunavectors/data/safrole/blocks/3_000.json",
          "../../jamdunavectors/data/safrole/blocks/3_001.json",
          "../../jamdunavectors/data/safrole/blocks/3_002.json",
          "../../jamdunavectors/data/safrole/blocks/3_003.json",
          "../../jamdunavectors/data/safrole/blocks/3_004.json",
          "../../jamdunavectors/data/safrole/blocks/3_005.json",
          "../../jamdunavectors/data/safrole/blocks/3_006.json",
          "../../jamdunavectors/data/safrole/blocks/3_007.json",
          "../../jamdunavectors/data/safrole/blocks/3_008.json",
          "../../jamdunavectors/data/safrole/blocks/3_009.json",
          "../../jamdunavectors/data/safrole/blocks/3_010.json",
          "../../jamdunavectors/data/safrole/blocks/3_011.json",
          "../../jamdunavectors/data/safrole/blocks/4_000.json",
          "../../jamdunavectors/data/safrole/blocks/4_001.json",
          "../../jamdunavectors/data/safrole/blocks/4_002.json",
          "../../jamdunavectors/data/safrole/blocks/4_003.json",
          "../../jamdunavectors/data/safrole/blocks/4_004.json",
          "../../jamdunavectors/data/safrole/blocks/4_005.json",
          "../../jamdunavectors/data/safrole/blocks/4_006.json",
          "../../jamdunavectors/data/safrole/blocks/4_007.json",
          "../../jamdunavectors/data/safrole/blocks/4_008.json",
          "../../jamdunavectors/data/safrole/blocks/4_009.json",
          "../../jamdunavectors/data/safrole/blocks/4_010.json",
          "../../jamdunavectors/data/safrole/blocks/4_011.json",
          "../../jamdunavectors/data/safrole/blocks/5_000.json",
        ],
        dbPath: DB_PATH,
        genesisBlock: "../../jamdunavectors/chainspecs/blocks/genesis-tiny.json",
        genesis: "../../jamdunavectors/chainspecs/state_snapshots/genesis-tiny.json",
        genesisRoot: Bytes.parseBytesNoPrefix(GENESIS_ROOT, HASH_SIZE).asOpaque(),
        genesisHeaderHash: Bytes.zero(HASH_SIZE).asOpaque(),
        chainSpec: KnownChainSpec.Tiny,
      },
    }).catch((e) => {
      console.error(`${e}`);
      process.exit(-1);
    });
  }
}

main();
