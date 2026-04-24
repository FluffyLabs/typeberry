import { logger, main, parseArgs } from "./common.js";
import { runners } from "./w3f/runners.js";

const r = await main(runners, "test-vectors/w3f_072", {
  ...parseArgs(process.argv.slice(2)),
  patterns: [".json"],
  accepted: {
    ".json": ["traces", "codec", "stf"],
  },
  ignored: [
    "genesis.json",
    "reports/tiny/report_with_no_results-1.json", // WorkItemsCount: Expected '1 <= count <= 16' got 0
    "reports/full/report_with_no_results-1.json", // WorkItemsCount: Expected '1 <= count <= 16' got 0
  ],
});
logger.log`${r}`;
