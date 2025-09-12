import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/jam-conformance/fuzz-reports/0.6.7/traces", {
  ignored: [
    "genesis.json",
    // incorrect DESIGNATE?
    "traces/1754990132/00000012.json",
    // CORRECT: rejecting block because of incorrect ticket attempt
    "traces/1755252727/00000011.json",
  ],
})
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(`${e}`);
    process.exit(-1);
  });
