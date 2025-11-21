import { StateTransition } from "@typeberry/state-vectors";
import { logger, main, parseArgs, runner } from "./common.js";
import { runStateTransition } from "./state-transition/state-transition.js";

const runners = [
  runner("state_transition", runStateTransition)
    .fromJson(StateTransition.fromJson)
    .fromBin(StateTransition.Codec)
    .withVariants(["ananas", "builtin"]),
].map((x) => x.build());

main(runners, "test-vectors/javajam", {
  ...parseArgs(process.argv.slice(2)),
  patterns: [".json"],
  accepted: {
    ".json": ["stf/state_transitions/"],
  },
  ignored: ["testnetKeys.json", "stf/blocks/", "erasure_coding/"],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
