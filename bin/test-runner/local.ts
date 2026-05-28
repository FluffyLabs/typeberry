import { logger, main, parseArgs } from "./common.js";
import { runners } from "./w3f/runners.js";

// Runs test vectors committed in-repo under `test-vectors-local/`.
// Unlike the other suites, these are not fetched from an external submodule,
// so they can act as a permanent, must-pass regression gate (e.g. captured
// fuzzer traces). Drop `StateTransition` vectors under `test-vectors-local/traces/`.
main(runners, "test-vectors-local", {
  ...parseArgs(process.argv.slice(2)),
  accepted: {
    ".bin": ["traces"],
    ".json": ["traces"],
  },
  ignored: ["genesis.bin", "genesis.json"],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
