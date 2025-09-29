import { logger, main, runner } from "./common.js";
import { runStateTransition, StateTransition } from "./state-transition/state-transition.js";

const runners = [runner("state_transition", StateTransition.fromJson, runStateTransition)];

main(runners, process.argv.slice(2), "test-vectors/javajam", {
  accepted: ["stf/state_transitions/"],
  ignored: ["testnetKeys.json", "stf/blocks/", "erasure_coding/"],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
