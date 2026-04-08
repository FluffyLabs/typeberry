import { StateTransition } from "@typeberry/state-vectors";
import { ALL_PVMS, logger, main, parseArgs, runner } from "./common.js";
import { runStateTransition } from "./state-transition/state-transition.js";

const runners = [
  runner("state_transition", runStateTransition)
    .fromJson(StateTransition.fromJson)
    .fromBin(StateTransition.Codec)
    .withVariants(ALL_PVMS),
].map((x) => x.build());

main(runners, "test-vectors/javajam_071", {
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
