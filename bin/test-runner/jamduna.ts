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
    "orderedaccumulation/state_transitions/2_007.json",
    "orderedaccumulation/state_transitions/2_009.json",
    "orderedaccumulation/state_transitions/2_011.json",
    "orderedaccumulation/state_transitions/3_000.json",
    "orderedaccumulation/state_transitions/3_001.json",
    "orderedaccumulation/state_transitions/3_003.json",
    "orderedaccumulation/state_transitions/3_005.json",
    "orderedaccumulation/state_transitions/3_007.json",
    "orderedaccumulation/state_transitions/3_009.json",
  ],
})
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(`${e}`);
    process.exit(-1);
  });
