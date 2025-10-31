import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/w3f-davxy_071", {
  patterns: [".json"],
  accepted: {
    ".json": ["traces", "codec", "stf"],
  },
  ignored: [
    "genesis.json",
    "genesis.bin",
    "fuzzy/00000014", // statistics + alot
    "fuzzy/00000016", // statistics + alot
    "fuzzy/00000037", // statistics + afew
    "fuzzy/00000111", // statistics
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
