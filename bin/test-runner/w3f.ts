import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/w3f-fluffy", {
  ignored: [
    "traces/",
    // TODO [ToDr] Erasure coding test vectors need to be updated to GP 0.7.0
    "erasure/",
  ],
})
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(`${e}`);
    process.exit(-1);
  });
