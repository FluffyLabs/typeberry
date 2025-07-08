import { logger, main, runner } from "./common.js";
import { StateTransitionFuzzed, runStateTransitionFuzzed } from "./jamduna/state-transition-fuzzed.js";
import { StateTransition, runStateTransition } from "./jamduna/state-transition.js";

const runners = [
  runner("state_transitions", StateTransition.fromJson, runStateTransition),
  runner("safrole/state_transitions_fuzzed", StateTransitionFuzzed.fromJson, runStateTransitionFuzzed),
];

main(runners, process.argv.slice(2), "test-vectors/jamduna", {
  accepted: [
    "generic/state_transitions",
  ],
  ignored: [
    "/state_snapshots/",
  ],
})
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(`${e}`);
    process.exit(-1);
  });
