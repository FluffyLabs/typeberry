import { logger, main, parseArgs } from "./common.js";
import { runners } from "./w3f/runners.js";

const r = await main(runners, "test-vectors/jam-conformance/fuzz-reports/0.7.2/traces", {
  ...parseArgs(process.argv.slice(2)),
  patterns: [".json"],
  ignored: [
    // genesis file is unparsable
    "genesis.json",

    // Block should be rejected?
    "1766565819_2010/00000225.json",
  ],
});
logger.log`${r}`;
