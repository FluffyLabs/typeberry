import { JamConfig } from "@typeberry/config";
import { main as jam, loadConfig } from "@typeberry/jam";
import { Level, Logger } from "@typeberry/logger";
import { DEFAULTS } from "../../jam-cli/args.js";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);

const withRelPath = (path: string) => {
  return `../../${path}`;
};

async function main() {
  const nodeConfig = loadConfig(`${import.meta.dirname}/e2e.config.json`);
  const jamConfig = JamConfig.new({ nodeName: DEFAULTS.name, blockToImport: files, nodeConfig });
  try {
    await jam(jamConfig, withRelPath);
  } catch (e) {
    console.error(`${e}`);
    process.exit(-1);
  }
}

const files = [
  "jamdunavectors/data/safrole/blocks/1_000.json",
  "jamdunavectors/data/safrole/blocks/1_001.json",
  "jamdunavectors/data/safrole/blocks/1_002.json",
  "jamdunavectors/data/safrole/blocks/1_003.json",
  "jamdunavectors/data/safrole/blocks/1_004.json",
  "jamdunavectors/data/safrole/blocks/1_005.json",
  "jamdunavectors/data/safrole/blocks/1_006.json",
  "jamdunavectors/data/safrole/blocks/1_007.json",
  "jamdunavectors/data/safrole/blocks/1_008.json",
  "jamdunavectors/data/safrole/blocks/1_009.json",
  "jamdunavectors/data/safrole/blocks/1_010.json",
  "jamdunavectors/data/safrole/blocks/1_011.json",
  "jamdunavectors/data/safrole/blocks/2_000.json",
  "jamdunavectors/data/safrole/blocks/2_001.json",
  "jamdunavectors/data/safrole/blocks/2_002.json",
  "jamdunavectors/data/safrole/blocks/2_003.json",
  "jamdunavectors/data/safrole/blocks/2_004.json",
  "jamdunavectors/data/safrole/blocks/2_005.json",
  "jamdunavectors/data/safrole/blocks/2_006.json",
  "jamdunavectors/data/safrole/blocks/2_007.json",
  "jamdunavectors/data/safrole/blocks/2_008.json",
  "jamdunavectors/data/safrole/blocks/2_009.json",
  "jamdunavectors/data/safrole/blocks/2_010.json",
  "jamdunavectors/data/safrole/blocks/2_011.json",
  "jamdunavectors/data/safrole/blocks/3_000.json",
  "jamdunavectors/data/safrole/blocks/3_001.json",
  "jamdunavectors/data/safrole/blocks/3_002.json",
  "jamdunavectors/data/safrole/blocks/3_003.json",
  "jamdunavectors/data/safrole/blocks/3_004.json",
  "jamdunavectors/data/safrole/blocks/3_005.json",
  "jamdunavectors/data/safrole/blocks/3_006.json",
  "jamdunavectors/data/safrole/blocks/3_007.json",
  "jamdunavectors/data/safrole/blocks/3_008.json",
  "jamdunavectors/data/safrole/blocks/3_009.json",
  "jamdunavectors/data/safrole/blocks/3_010.json",
  "jamdunavectors/data/safrole/blocks/3_011.json",
  "jamdunavectors/data/safrole/blocks/4_000.json",
  "jamdunavectors/data/safrole/blocks/4_001.json",
  "jamdunavectors/data/safrole/blocks/4_002.json",
  "jamdunavectors/data/safrole/blocks/4_003.json",
  "jamdunavectors/data/safrole/blocks/4_004.json",
  "jamdunavectors/data/safrole/blocks/4_005.json",
  "jamdunavectors/data/safrole/blocks/4_006.json",
  "jamdunavectors/data/safrole/blocks/4_007.json",
  "jamdunavectors/data/safrole/blocks/4_008.json",
  "jamdunavectors/data/safrole/blocks/4_009.json",
  "jamdunavectors/data/safrole/blocks/4_010.json",
  "jamdunavectors/data/safrole/blocks/4_011.json",
  "jamdunavectors/data/safrole/blocks/5_000.json",
].map(withRelPath);

main();
