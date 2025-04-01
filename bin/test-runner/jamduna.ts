import { logger, main, runner } from "./common";
import { StateTransition, runStateTransition } from "./jamduna/stateTransition";

const runners = [runner("state_transitions", StateTransition.fromJson, runStateTransition)];

main(runners, "jamdunavectors", process.argv.slice(2))
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(e);
    process.exit(-1);
  });
