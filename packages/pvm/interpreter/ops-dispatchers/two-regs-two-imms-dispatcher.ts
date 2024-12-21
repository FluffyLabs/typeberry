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
      case Instruction.LOAD_IMM_JUMP_IND: {
        const address = this.dynamicJumpOps.caluclateJumpAddress(
          args.secondImmediateDecoder.getUnsigned(),
          args.secondRegisterIndex,
        );
        this.loadOps.loadImmediate(args.firstRegisterIndex, args.firstImmediateDecoder);
        this.dynamicJumpOps.jumpInd(address);
        break;
      }
    }
  }
}
