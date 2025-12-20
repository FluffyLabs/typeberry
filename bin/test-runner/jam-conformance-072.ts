import { logger, main, parseArgs } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, "test-vectors/jam-conformance/fuzz-reports/0.7.2/traces", {
  ...parseArgs(process.argv.slice(2)),
  patterns: [".json"],
  ignored: [
    // genesis file is unparsable
    "genesis.json",
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
