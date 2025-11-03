import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/w3f-davxy_071", {
  pattern: ".bin",
  accepted: ["traces/fuzzy"],
  ignored: [
    "genesis.bin",
    "report.bin",
    // "fuzzy/00000037.bin", // statistics + afew
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
