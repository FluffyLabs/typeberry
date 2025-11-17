import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/jam-conformance/fuzz-reports/0.7.1/traces", {
  patterns: [".json"],
  ignored: [
    // genesis file is unparsable
    "genesis.json",
    // statistics mismatch
    "1763371379/00000237.json",
    // offenders mismatch?
    "1763371403/00000171.json",
    // no timeslot in pre-state?
    "1763371531/00000042.json",
    // unrecognized test case (WorkItemsCount === 0) - valid behavior
    "1763371098/00000006.json"
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
