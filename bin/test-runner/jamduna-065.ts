import { logger, main, runner } from "./common.js";
import { StateTransition, runStateTransition } from "./state-transition/state-transition.js";

const runners = [runner("state_transition", StateTransition.fromJson, runStateTransition)];

main(runners, process.argv.slice(2), "test-vectors/jamduna_065", {
  accepted: ["generic/state_transitions/", "assurances/state_transitions/", "orderedaccumulation/state_transitions/"],
  ignored: [
    "assurances/state_transitions/00000026.json",
    "assurances/state_transitions/00000028.json",
    "assurances/state_transitions/00000030.json",
    "assurances/state_transitions/00000032.json",
    "assurances/state_transitions/00000035.json",
    "assurances/state_transitions/00000037.json",
    "assurances/state_transitions/00000039.json",
    "assurances/state_transitions/00000041.json",
    "assurances/state_transitions/00000043.json",
    "assurances/state_transitions/00000047.json",
    "orderedaccumulation/state_transitions/00000029.json",
    "orderedaccumulation/state_transitions/00000031.json",
    "orderedaccumulation/state_transitions/00000033.json",
    "orderedaccumulation/state_transitions/00000035.json",
    "orderedaccumulation/state_transitions/00000037.json",
    "orderedaccumulation/state_transitions/00000039.json",
  ],
})
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(`${e}`);
    process.exit(-1);
  });
