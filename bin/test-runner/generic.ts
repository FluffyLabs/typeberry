import { logger, main, parseArgs } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, "test-vectors", {
  ...parseArgs(process.argv.slice(2)),
  patterns: [".json", ".bin"],
  accumulateSequentially: true,
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
