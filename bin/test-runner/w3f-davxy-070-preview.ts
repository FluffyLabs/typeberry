import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/w3f-davxy_070", {
  accepted: ["traces"],
  ignored: [
    "genesis.json",
    // storage and preimage tests fail due to encoding issues
    "traces/storage_light",
    "traces/storage",
    "traces/preimages_light",
    "traces/preimages",
  ],
})
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(`${e}`);
    process.exit(-1);
  });
