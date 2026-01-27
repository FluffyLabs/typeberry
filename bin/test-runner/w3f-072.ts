import { logger, main, parseArgs } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, "test-vectors/w3f_072", {
  ...parseArgs(process.argv.slice(2)),
  patterns: [".json"],
  ignored: [
    "genesis.json",

    // TODO: Unrecognized test case
    "erasure/",
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
