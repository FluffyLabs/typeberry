import { logger, main, runner } from "./common";
import { AssurancesStateTransition, runAssurancesStateTransition } from "./jamduna/assurances";

const runners = [
  runner("assurances/state_transitions", AssurancesStateTransition.fromJson, runAssurancesStateTransition),
  runner("fallback/state_transitions", AssurancesStateTransition.fromJson, runAssurancesStateTransition),
];

main(runners, "jamdunavectors", process.argv.slice(2))
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(e);
    process.exit(-1);
  });
