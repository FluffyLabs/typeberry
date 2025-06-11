import type { OneOffsetArgs } from "../args-decoder/args-decoder.js";
import { Instruction } from "../instruction.js";
import type { BranchOps } from "../ops/index.js";

export class OneOffsetDispatcher {
  constructor(private branchOps: BranchOps) {}

  dispatch(instruction: Instruction, args: OneOffsetArgs) {
    switch (instruction) {
      case Instruction.JUMP:
        this.branchOps.jump(args.nextPc);
        break;
    }
  }
}
