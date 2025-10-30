import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/w3f-davxy_071", {
  pattern: ".bin",
  accepted: ["traces/fuzzy"],
  ignored: [
    "genesis.bin",
    "report.bin",
    "fuzzy/00000008.bin", // storage + alot?
    "fuzzy/00000009.bin", // statistics?
    "fuzzy/00000042.bin", // recent history?
    "fuzzy/00000068.bin", // statistics?
    "fuzzy/00000069.bin", // statistics?
    "fuzzy/00000096.bin", // statistics?
    "fuzzy/00000097.bin", // stats + alot?
    "fuzzy/00000103.bin", // statistics?
    "fuzzy/00000144.bin", // statistics?
    "fuzzy/00000151.bin", // history + few
    "fuzzy/00000181.bin", // history + few
    "fuzzy/00000188.bin", // statistics?
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
