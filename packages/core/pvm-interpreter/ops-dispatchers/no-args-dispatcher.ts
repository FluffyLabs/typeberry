import { Instruction } from "../instruction.js";
import type { NoArgsOps } from "../ops/index.js";

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
