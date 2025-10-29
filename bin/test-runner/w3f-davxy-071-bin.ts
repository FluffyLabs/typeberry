import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/w3f-davxy_071", {
  pattern: ".bin",
  accepted: ["traces/fuzzy"],
  ignored: [
    "genesis.bin",
    "report.bin",

    // "fuzzy/00000004.bin", // storage + alot?
    // "fuzzy/00000006.bin", // storage + alot?
    // "fuzzy/00000008.bin", // storage + alot?
    // "fuzzy/00000009.bin", // statistics?
    // "fuzzy/00000014.bin", // stats + alot?
    // "fuzzy/00000016.bin", // stats + few?
    // "fuzzy/00000019.bin", // storage + alot?
    // "fuzzy/00000042.bin", // recent history?
    // "fuzzy/00000068.bin", // statistics?
    // "fuzzy/00000069.bin", // statistics?
    // "fuzzy/00000071.bin", // recent history + alot
    // "fuzzy/00000081.bin", // alotalot (185)
    // "fuzzy/00000096.bin", // statistics?
    // "fuzzy/00000097.bin", // stats + alot?
    // "fuzzy/00000098.bin", // statistics?
    // "fuzzy/00000103.bin", // statistics?
    // "fuzzy/00000107.bin", // alotalot
    // "fuzzy/00000126.bin", // alotalot
    // "fuzzy/00000144.bin", // statistics?
    // "fuzzy/00000151.bin", // history + few
    // "fuzzy/00000181.bin", // history + few
    // "fuzzy/00000182.bin", // alotalot
    // "fuzzy/00000188.bin", // statistics?
    // "fuzzy/00000196.bin", // recent history
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
