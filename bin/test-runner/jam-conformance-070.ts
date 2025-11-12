import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/jam-conformance/fuzz-reports/0.7.0/traces", {
  patterns: [".json"],
  ignored: [
    // CORRECT: note [seko] test rejected at block parsing stage, which is considered valid behavior
    "traces/1757063641/00000180.json",
    "1758622442/00000164.json", // bug in GP 070
    "1758622403/00000239.json", // bug in GP 070
    // genesis file is unparsable
    "genesis.json",
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
