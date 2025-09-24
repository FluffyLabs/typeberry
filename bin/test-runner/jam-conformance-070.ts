import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/jam-conformance/fuzz-reports/0.7.0/traces", {
  ignored: [
    // CORRECT: note [seko] test rejected at block parsing stage, which is considered valid behavior
    "traces/1757063641/00000180.json",
    // genesis file is unparsable
    "genesis.json",
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
