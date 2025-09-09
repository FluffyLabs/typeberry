import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/jam-conformance/fuzz-reports/0.7.0/traces", {
  ignored: [
    "traces/1757092821/00000156.json", // note [seko] storage differences, statistics differences (gas used)
    "traces/1757062927/00000091.json", // note [seko] block should be rejected but isn't
    "traces/1756548741/00000059.json", // note [seko] mismatch in storage bytes used and accumulate gas used
    "traces/1756548706/00000094.json", // note [seko] 2 storage entries should be deleted but they aren't
    "traces/1757063641/00000180.json", // note [seko] test rejected at block parsing stage, which is considered valid behavior
  ],
})
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(`${e}`);
    process.exit(-1);
  });
