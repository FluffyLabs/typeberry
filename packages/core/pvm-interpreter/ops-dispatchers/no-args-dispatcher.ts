import { Instruction } from "../instruction";
import type { NoArgsOps } from "../ops";

export class NoArgsDispatcher {
  constructor(private noArgsOps: NoArgsOps) {}

  dispatch(instruction: Instruction) {
    switch (instruction) {
      case Instruction.TRAP:
        this.noArgsOps.trap();
        break;

      case Instruction.FALLTHROUGH:
        this.noArgsOps.fallthrough();
        break;
    }
  }
}
