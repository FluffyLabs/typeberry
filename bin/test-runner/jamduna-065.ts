import { logger, main, runner } from "./common.js";
import { StateTransition, runStateTransition } from "./state-transition/state-transition.js";

const runners = [runner("state_transition", StateTransition.fromJson, runStateTransition)];

main(runners, process.argv.slice(2), "test-vectors/jamduna_065", {
  accepted: ["generic/state_transitions/", "assurances/state_transitions/", "orderedaccumulation/state_transitions/"],
  ignored: [
    // TODO: [MaSi]: It looks like those test vectors have incorrect expected state. As 065 is not an official release, we can ignore them for now.
    "assurances/state_transitions/00000035.json",
    "assurances/state_transitions/00000037.json",
    "assurances/state_transitions/00000043.json",
    "assurances/state_transitions/00000047.json",
  ],
})
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(`${e}`);
    process.exit(-1);
  });
