import { logger, main, parseArgs } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, "test-vectors/w3f-davxy_071", {
  ...parseArgs(process.argv.slice(2)),
  patterns: [".json"],
  accepted: {
    ".json": ["traces", "codec", "stf"],
  },
  ignored: ["genesis.json"],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
