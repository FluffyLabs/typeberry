import { logger, main, parseArgs } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, "test-vectors/w3f_070", {
  ...parseArgs(process.argv.slice(2)),
  patterns: [".json"],
  ignored: [
    "genesis.json",

    // TODO: Unrecognized test case
    "erasure/",

    // Invalid test cases
    // Tests case uses json structure from v0.7.1+
    // Unrecognized test case
    "codec/tiny/work_package.json",
    "codec/full/work_package.json",
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
