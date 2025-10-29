import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/w3f-davxy_071", {
  pattern: ".bin",
  accepted: ["traces/fuzzy"],
  ignored: [
    "genesis.bin",
    "report.bin",

    "fuzzy/00000008.bin", // service
    "fuzzy/00000009.bin", // service
    "fuzzy/00000042.bin", // service
    "fuzzy/00000068.bin", // service
    "fuzzy/00000069.bin", // service
    "fuzzy/00000096.bin", // service
    "fuzzy/00000097.bin", // service
    "fuzzy/00000103.bin", // service
    "fuzzy/00000144.bin", // statistics
    "fuzzy/00000151.bin", // service
    "fuzzy/00000181.bin", // service
    "fuzzy/00000188.bin", // statistics
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
