import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/w3f-davxy_070", {
  patterns: [".json"],
  accepted: {
    ".json": ["traces"],
  },
  ignored: [
    "genesis.json",
    "1758622442/00000164.json", // bug in GP 070
    "1758622403/00000239.json", // bug in GP 070
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
