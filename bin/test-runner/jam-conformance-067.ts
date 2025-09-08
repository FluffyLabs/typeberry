import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/jam-conformance/fuzz-reports/0.6.7/traces", {
  ignored: [
    "genesis.json",
    "traces/1754982630/00000008.json",
    "traces/1754982630/00000009.json",
    "traces/1754990132/00000012.json",
    "traces/1755186771/00000029.json",
    "traces/1755248982/00000004.json",
    "traces/1755252727/00000011.json",
    "traces/1755530509/00000004.json",
    "traces/1755530535/00000011.json",
    "traces/1755530728/00000008.json",
    "traces/1755530896/00000008.json",
    "traces/1755531265/00000008.json",
    "traces/1755620371/00000008.json",
    "traces/1755796851/00000016.json",
    "traces/1755796995/00000011.json",
  ],
})
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(`${e}`);
    process.exit(-1);
  });
