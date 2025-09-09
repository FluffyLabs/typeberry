import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/jam-conformance/fuzz-reports/0.6.7/traces", {
  ignored: [
    "genesis.json",
    // invalid UPGRADE (lookup history and some storage not updated)?
    "traces/1754982630/00000008.json",
    // incorrect statistics - service code not found?
    "traces/1754982630/00000009.json",
    // incorrect DESIGNATE?
    "traces/1754990132/00000012.json",
    // incorrect UPGRADE (lookup history not updated)?
    "traces/1755186771/00000029.json",
    // CORRECT: rejecting block because of incorrect ticket attempt
    "traces/1755252727/00000011.json",
    // Random jump, but involves a bunch of CHECKPOINTs?
    "traces/1755530535/00000011.json",
    // incorrect TRANSFER logic?
    "traces/1755530728/00000008.json",
    // incorrect TRANSFER logic?
    "traces/1755530896/00000008.json",
    // incorrect TRANSFER logic?
    "traces/1755620371/00000008.json",
    // incorrect storage value?
    "traces/1755796851/00000016.json",
    // incorrect storage value?
    "traces/1755796995/00000011.json",
  ],
})
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(`${e}`);
    process.exit(-1);
  });
