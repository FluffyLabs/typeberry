import { logger, main, parseArgs } from "./common.js";
import { runners } from "./w3f/runners.js";

const r = await main(runners, "test-vectors/jam-conformance/fuzz-reports/0.7.1/traces", {
  ...parseArgs(process.argv.slice(2)),
  patterns: [".json"],
  ignored: [
    // genesis file is unparsable
    "genesis.json",

    // unrecognized test cases
    // no timeslot in pre-state - valid behavior
    "1763371531/00000042.json",
    "1763489287/00000872.json",
  ],
});
logger.log`${r}`;
