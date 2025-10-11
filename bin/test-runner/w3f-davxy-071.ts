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
    // 0x0d statistics + shitload other
    "traces/fuzzy/00000058.json",
    "traces/fuzzy/00000073.json",
    "traces/fuzzy/00000161.json",
    "traces/fuzzy/00000179.json",
    "traces/fuzzy/00000192.json",
    // 0x03 + shitload of other stuff
    "traces/fuzzy/00000046.json",
    "traces/fuzzy/00000061.json",
    "traces/fuzzy/00000063.json",
    "traces/fuzzy/00000066.json",
    "traces/fuzzy/00000076.json",
    "traces/fuzzy/00000089.json",
    "traces/fuzzy/00000100.json",
    "traces/fuzzy/00000107.json",
    "traces/fuzzy/00000144.json",
    "traces/fuzzy/00000166.json",
    "traces/fuzzy/00000184.json",
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
