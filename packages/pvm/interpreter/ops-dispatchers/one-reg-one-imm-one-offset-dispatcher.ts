import type { OneRegisterOneImmediateOneOffsetArgs } from "../args-decoder/args-decoder";
import { Instruction } from "../instruction";
import type { BranchOps, LoadOps } from "../ops";
import { signExtend32To64 } from "../registers";

export class OneRegOneImmOneOffsetDispatcher {
  constructor(
    private branchOps: BranchOps,
    private loadOps: LoadOps,
  ) {}

  dispatch(instruction: Instruction, args: OneRegisterOneImmediateOneOffsetArgs) {
    switch (instruction) {
      case Instruction.LOAD_IMM_JUMP:
        this.loadOps.loadImmediate(args.registerIndex, args.immediateDecoder.getUnsigned());
        this.branchOps.jump(args.nextPc);
        break;
      case Instruction.BRANCH_EQ_IMM:
        this.branchOps.branchEqImmediate(
          args.registerIndex,
          signExtend32To64(args.immediateDecoder.getUnsigned()),
          args.nextPc,
        );
        break;
      case Instruction.BRANCH_NE_IMM:
        this.branchOps.branchNeImmediate(args.registerIndex, BigInt(args.immediateDecoder.getUnsigned()), args.nextPc);
        break;
      case Instruction.BRANCH_LT_U_IMM:
        this.branchOps.branchLtUnsignedImmediate(
          args.registerIndex,
          BigInt(args.immediateDecoder.getUnsigned()),
          args.nextPc,
        );
        break;
      case Instruction.BRANCH_LE_U_IMM:
        this.branchOps.branchLeUnsignedImmediate(
          args.registerIndex,
          BigInt(args.immediateDecoder.getUnsigned()),
          args.nextPc,
        );
        break;
      case Instruction.BRANCH_GE_U_IMM:
        this.branchOps.branchGeUnsignedImmediate(
          args.registerIndex,
          BigInt(args.immediateDecoder.getUnsigned()),
          args.nextPc,
        );
        break;
      case Instruction.BRANCH_GT_U_IMM:
        this.branchOps.branchGtUnsignedImmediate(
          args.registerIndex,
          BigInt(args.immediateDecoder.getUnsigned()),
          args.nextPc,
        );
        break;
      case Instruction.BRANCH_LT_S_IMM:
        this.branchOps.branchLtSignedImmediate(
          args.registerIndex,
          BigInt(args.immediateDecoder.getSigned()),
          args.nextPc,
        );
        break;
      case Instruction.BRANCH_LE_S_IMM:
        this.branchOps.branchLeSignedImmediate(
          args.registerIndex,
          BigInt(args.immediateDecoder.getSigned()),
          args.nextPc,
        );
        break;
      case Instruction.BRANCH_GE_S_IMM:
        this.branchOps.branchGeSignedImmediate(
          args.registerIndex,
          BigInt(args.immediateDecoder.getSigned()),
          args.nextPc,
        );
        break;
      case Instruction.BRANCH_GT_S_IMM:
        this.branchOps.branchGtSignedImmediate(
          args.registerIndex,
          BigInt(args.immediateDecoder.getSigned()),
          args.nextPc,
        );
        break;
    }
  }
}
