import type { OneImmediateResult } from "../args-decoder/args-decoder";
import { Instruction } from "../instruction";
import type { HostCallOps } from "../ops";

export class OneImmDispatcher {
  constructor(private hostCallOps: HostCallOps) {}

  dispatch(instruction: Instruction, args: OneImmediateResult) {
    switch (instruction) {
      case Instruction.ECALLI:
        this.hostCallOps.hostCall(args.immediateDecoder);
        break;
    }
  }
}
