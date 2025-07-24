import { logger, main, runner } from "./common.js";
import { StateTransitionFuzzed, runStateTransitionFuzzed } from "./jamduna/state-transition-fuzzed.js";
import { StateTransition, runStateTransition } from "./jamduna/state-transition.js";

const runners = [
  runner("state_transitions", StateTransition.fromJson, runStateTransition),
  runner("safrole/state_transitions_fuzzed", StateTransitionFuzzed.fromJson, runStateTransitionFuzzed),
];

main(runners, process.argv.slice(2), "test-vectors/jamduna", {
  accepted: [
    "safrole/state_transitions",
    "disputes/state_transitions",
    "safrole/state_transitions_fuzzed",
    "fallback/state_transitions",
  ],
  ignored: [
    "disputes/state_transitions/2_005.json",
    "disputes/state_transitions/3_005.json",
    // Ignoring, since they are invalid and we cannot even parse them.
    "BadTicketAttemptNumber.json",
    // we only run independent state-transition tests
    "/chainspecs/",
    "/blocks/",
    "/state_snapshots/",
  ],
})
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(`${e}`);
    process.exit(-1);
  });
