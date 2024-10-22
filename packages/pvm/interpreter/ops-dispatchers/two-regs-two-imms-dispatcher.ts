import type { TwoRegistersTwoImmediatesArgs } from "../args-decoder/args-decoder";
import { Instruction } from "../instruction";
import type { DynamicJumpOps, LoadOps } from "../ops";

export class TwoRegsTwoImmsDispatcher {
  constructor(
    private loadOps: LoadOps,
    private dynamicJumpOps: DynamicJumpOps,
  ) {}

  dispatch(instruction: Instruction, args: TwoRegistersTwoImmediatesArgs) {
    switch (instruction) {
      case Instruction.LOAD_IMM_JUMP_IND:
        this.loadOps.loadImmediate(args.firstRegisterIndex, args.firstImmediateDecoder.getUnsigned());
        this.dynamicJumpOps.jumpInd(args.secondImmediateDecoder.getUnsigned(), args.secondRegisterIndex);
        break;
    }
  }
}
