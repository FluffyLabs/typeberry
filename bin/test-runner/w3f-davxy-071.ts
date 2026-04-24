import { logger, main, parseArgs } from "./common.js";
import { runners } from "./w3f/runners.js";

const r = await main(runners, "test-vectors/w3f-davxy_071", {
  ...parseArgs(process.argv.slice(2)),
  patterns: [".json"],
  accepted: {
    ".json": ["traces", "codec", "stf"],
  },
  ignored: ["genesis.json"],
});
logger.log`${r}`;
