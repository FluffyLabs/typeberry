import { logger, main, runner } from "./common.js";
import { StateTransitionFuzzed, runStateTransitionFuzzed } from "./jamduna-064/state-transition-fuzzed.js";
import { StateTransition, runStateTransition } from "./jamduna-064/state-transition.js";

const runners = [
  runner("state_transitions", StateTransition.fromJson, runStateTransition),
  runner("safrole/state_transitions_fuzzed", StateTransitionFuzzed.fromJson, runStateTransitionFuzzed),
];

main(runners, process.argv.slice(2), "test-vectors/jamduna_064", {
  accepted: [
    "safrole/state_transitions",
    "disputes/state_transitions",
    "assurances/state_transitions/",
    "orderedaccumulation/state_transitions/",
    "safrole/state_transitions_fuzzed",
    "fallback/state_transitions",
  ],
  ignored: [
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
