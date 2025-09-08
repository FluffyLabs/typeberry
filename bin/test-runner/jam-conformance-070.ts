import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/jam-conformance/fuzz-reports/0.7.0/traces", {
  ignored: [
    "traces/1757092821/00000156.json",
    "traces/1757062927/00000091.json",
    "traces/1756548796/00000004.json",
    "traces/1756548767/00000005.json",
    "traces/1756548767/00000006.json",
    "traces/1756548741/00000059.json",
    "traces/1756548706/00000094.json",
    "traces/1756548667/00000004.json",
    "traces/1756548583/00000008.json",
    "traces/1757063641/00000180.json",
  ],
})
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(`${e}`);
    process.exit(-1);
  });
