import { logger, main, parseArgs } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, "test-vectors/w3f-fluffy", {
  ...parseArgs(process.argv.slice(2)),
  patterns: [".json"],
  ignored: [
    "genesis.json",
    // TODO [MaSo] Erasure coding test vectors need to be updated
    "erasure/",
    // TODO: [MaSo] Needs fixing/compatibility adjusting
    "trie/",
    // Tests case uses version 0.7.1
    "codec/tiny/work_package.json",
    "codec/full/work_package.json",
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
