import type { TwoRegistersArgs } from "../args-decoder/args-decoder";
import { Instruction } from "../instruction";
import type { MoveOps } from "../ops";

export class TwoRegsDispatcher {
  constructor(private moveOps: MoveOps) {}

  dispatch(instruction: Instruction, args: TwoRegistersArgs) {
    switch (instruction) {
      case Instruction.MOVE_REG: {
        this.moveOps.moveRegister(args.firstRegisterIndex, args.secondRegisterIndex);
        break;
      }
    }
  }
}
