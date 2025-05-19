import { logger, main, runner } from "./common.js";
import { StateTransition, runStateTransition } from "./jamduna/stateTransition.js";
import { StateTransitionFuzzed, runStateTransitionFuzzed } from "./jamduna/stateTransitionFuzzed.js";

const runners = [
  runner("state_transitions", StateTransition.fromJson, runStateTransition),
  runner("safrole/state_transitions_fuzzed", StateTransitionFuzzed.fromJson, runStateTransitionFuzzed),
];

main(runners, "jamdunavectors", process.argv.slice(2))
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(`${e}`);
    process.exit(-1);
  });
