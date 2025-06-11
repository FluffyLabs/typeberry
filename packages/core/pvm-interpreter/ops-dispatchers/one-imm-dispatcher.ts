import type { OneImmediateArgs } from "../args-decoder/args-decoder.js";
import { Instruction } from "../instruction.js";
import type { HostCallOps } from "../ops/index.js";

export class OneImmDispatcher {
  constructor(private hostCallOps: HostCallOps) {}

  dispatch(instruction: Instruction, args: OneImmediateArgs) {
    switch (instruction) {
      case Instruction.ECALLI:
        this.hostCallOps.hostCall(args.immediateDecoder);
        break;
    }
  }
}
