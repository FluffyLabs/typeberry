import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/w3f-davxy_066", {
  accepted: ["traces/safrole", "traces/fallback"],
  ignored: ["genesis.json"],
})
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(`${e}`);
    process.exit(-1);
  });
