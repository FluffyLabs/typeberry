import { logger, main, parseArgs } from "./common.js";
import { FLAKY_ON_BUN } from "./jam-conformance-072-flaky-list.js";
import { runners } from "./w3f/runners.js";

// This suite ONLY runs the test vectors that are known to be flaky under bun's
// wasm runtime (see https://github.com/oven-sh/bun/issues/26366 and #15879).
// They pass under Node.js with tsx and the main jam-conformance-072.ts suite
// excludes them so CI stays green. This suite is expected to have some
// failures and is run with `continue-on-error` in CI.
const r = await main(runners, "test-vectors/jam-conformance/fuzz-reports/0.7.2/traces", {
  ...parseArgs(process.argv.slice(2)),
  patterns: [".json"],
  accepted: {
    ".json": FLAKY_ON_BUN,
  },
  ignored: [
    // genesis file is unparsable
    "genesis.json",
    // Block should be rejected?
    "1766565819_2010/00000225.json",
  ],
});
logger.log`${r}`;
