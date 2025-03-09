import type { OneOffsetArgs } from "../args-decoder/args-decoder";
import { Instruction } from "../instruction";
import type { BranchOps } from "../ops";

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
