import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/w3f-davxy_071", {
  accepted: ["traces", "codec", "stf"],
  ignored: [
    "genesis.json",
    "fuzzy/00000037.json", // statistics + afew
    "fuzzy/00000111.json", // statistics
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
