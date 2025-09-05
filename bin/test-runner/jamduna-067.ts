import { logger, main, runner } from "./common.js";
import { StateTransition, runStateTransition } from "./state-transition/state-transition.js";

const runners = [runner("state_transition", StateTransition.fromJson, runStateTransition)];

main(runners, process.argv.slice(2), "test-vectors/jamduna_067", {
  accepted: ["safrole/state_transitions/"],
  ignored: [
    "safrole/state_transitions/00000019.json",
    "safrole/state_transitions/00000021.json",
    "safrole/state_transitions/00000023.json",
    "safrole/state_transitions/00000032.json",
    "safrole/state_transitions/00000034.json",
    "safrole/state_transitions/00000036.json",
    "safrole/state_transitions/00000038.json",
    "safrole/state_transitions/00000040.json",
    "safrole/state_transitions/00000042.json",
    "safrole/state_transitions/00000044.json",
    "safrole/state_transitions/00000046.json",
    "safrole/state_transitions/00000048.json",
    "safrole/state_transitions/00000050.json",
    "safrole/state_transitions/00000052.json",
    "safrole/state_transitions/00000054.json",
    "safrole/state_transitions/00000056.json",
    "safrole/state_transitions/00000058.json",
    "safrole/state_transitions/00000060.json",
    "safrole/state_transitions/00000062.json",
    "safrole/state_transitions/00000064.json",
    "safrole/state_transitions/00000066.json",
    "safrole/state_transitions/00000068.json",
    "safrole/state_transitions/00000070.json",
    "safrole/state_transitions/00000072.json",
    "safrole/state_transitions/00000074.json",
    "safrole/state_transitions/00000076.json",
    "safrole/state_transitions/00000078.json",
    "safrole/state_transitions/00000080.json",
    "safrole/state_transitions/00000082.json",
    "safrole/state_transitions/00000084.json",
    "safrole/state_transitions/00000086.json",
    "safrole/state_transitions/00000088.json",
    "safrole/state_transitions/00000090.json",
    "safrole/state_transitions/00000092.json",
    "safrole/state_transitions/00000094.json",
    "safrole/state_transitions/00000096.json",
    "safrole/state_transitions/00000098.json",
    "safrole/state_transitions/00000100.json",
    "safrole/state_transitions/00000102.json",
  ],
})
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(`${e}`);
    process.exit(-1);
  });
