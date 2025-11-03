import { logger, main, runner } from "./common.js";
import { runStateTransition, StateTransition } from "./state-transition/state-transition.js";

const runners = [
  runner("state_transition", runStateTransition)
    .fromJson(StateTransition.fromJson)
    .fromBin(StateTransition.Codec)
    .withVariants(["ananas", "builtin"]),
].map((x) => x.build());

main(runners, process.argv.slice(2), "test-vectors/jamduna_067", {
  patterns: [".json"],
  accepted: {
    ".json": ["traces/"],
  },
  ignored: [],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
