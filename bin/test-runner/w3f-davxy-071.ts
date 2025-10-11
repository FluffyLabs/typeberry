import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/w3f-davxy_071", {
  accepted: ["traces", "codec", "stf"],
  ignored: [
    "genesis.json",
    // 0x0d statistics mismatch (+ storage?)
    "traces/fuzzy/00000004.json",
    "traces/fuzzy/00000006.json",
    "traces/fuzzy/00000008.json",
    "traces/fuzzy/00000009.json",
    "traces/fuzzy/00000013.json",
    "traces/fuzzy/00000024.json",
    "traces/fuzzy/00000029.json",
    "traces/fuzzy/00000068.json",
    "traces/fuzzy/00000069.json",
    "traces/fuzzy/00000114.json",
    "traces/fuzzy/00000118.json",
    "traces/fuzzy/00000120.json",
    "traces/fuzzy/00000126.json",
    "traces/fuzzy/00000143.json",
    "traces/fuzzy/00000163.json",
    "traces/fuzzy/00000185.json",
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
