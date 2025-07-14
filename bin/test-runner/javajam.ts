import { main, runner } from "./common.js";
import { runStateTransition, StateTransition } from "./state-transition/state-transition.js";

const runners = [
  runner("state_transition", StateTransition.fromJson, runStateTransition),
];

main()
