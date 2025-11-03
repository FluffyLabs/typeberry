import { StateTransition } from "@typeberry/state-vectors";
import { logger, main, runner } from "./common.js";
import { runStateTransition } from "./state-transition/state-transition.js";

const runners = [runner("traces", StateTransition.fromJson, runStateTransition)];

main(runners, process.argv.slice(2), "test-vectors/jamduna_067", {
  accepted: ["traces/"],
  ignored: [],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
