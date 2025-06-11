import type { OneRegisterOneImmediateOneOffsetArgs } from "../args-decoder/args-decoder.js";
import { Instruction } from "../instruction.js";
import type { BranchOps, LoadOps } from "../ops/index.js";

export class OneRegOneImmOneOffsetDispatcher {
  constructor(
    private branchOps: BranchOps,
    private loadOps: LoadOps,
  ) {}

  dispatch(instruction: Instruction, args: OneRegisterOneImmediateOneOffsetArgs) {
    switch (instruction) {
      case Instruction.LOAD_IMM_JUMP:
        this.loadOps.loadImmediate(args.registerIndex, args.immediateDecoder);
        this.branchOps.jump(args.nextPc);
        break;
      case Instruction.BRANCH_EQ_IMM:
        this.branchOps.branchEqImmediate(args.registerIndex, args.immediateDecoder, args.nextPc);
        break;
      case Instruction.BRANCH_NE_IMM:
        this.branchOps.branchNeImmediate(args.registerIndex, args.immediateDecoder, args.nextPc);
        break;
      case Instruction.BRANCH_LT_U_IMM:
        this.branchOps.branchLtUnsignedImmediate(args.registerIndex, args.immediateDecoder, args.nextPc);
        break;
      case Instruction.BRANCH_LE_U_IMM:
        this.branchOps.branchLeUnsignedImmediate(args.registerIndex, args.immediateDecoder, args.nextPc);
        break;
      case Instruction.BRANCH_GE_U_IMM:
        this.branchOps.branchGeUnsignedImmediate(args.registerIndex, args.immediateDecoder, args.nextPc);
        break;
      case Instruction.BRANCH_GT_U_IMM:
        this.branchOps.branchGtUnsignedImmediate(args.registerIndex, args.immediateDecoder, args.nextPc);
        break;
      case Instruction.BRANCH_LT_S_IMM:
        this.branchOps.branchLtSignedImmediate(args.registerIndex, args.immediateDecoder, args.nextPc);
        break;
      case Instruction.BRANCH_LE_S_IMM:
        this.branchOps.branchLeSignedImmediate(args.registerIndex, args.immediateDecoder, args.nextPc);
        break;
      case Instruction.BRANCH_GE_S_IMM:
        this.branchOps.branchGeSignedImmediate(args.registerIndex, args.immediateDecoder, args.nextPc);
        break;
      case Instruction.BRANCH_GT_S_IMM:
        this.branchOps.branchGtSignedImmediate(args.registerIndex, args.immediateDecoder, args.nextPc);
        break;
    }
  }
}
