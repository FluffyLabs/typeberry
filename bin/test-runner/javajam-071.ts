import { StateTransition } from "@typeberry/state-vectors";
import { logger, main, parseArgs, runner, SelectedPvm } from "./common.js";
import { runStateTransition } from "./state-transition/state-transition.js";

const runners = [
  runner("state_transition", runStateTransition)
    .fromJson(StateTransition.fromJson)
    .fromBin(StateTransition.Codec)
    .withVariants([SelectedPvm.Ananas, SelectedPvm.Builtin]),
].map((x) => x.build());

const r = await main(runners, "test-vectors/javajam_071", {
  ...parseArgs(process.argv.slice(2)),
  patterns: [".json"],
  accepted: {
    ".json": ["stf/state_transitions/"],
  },
  ignored: ["testnetKeys.json", "stf/blocks/", "erasure_coding/"],
});
logger.log`${r}`;
