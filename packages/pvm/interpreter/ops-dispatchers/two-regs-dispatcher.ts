import type { TwoRegistersArgs } from "../args-decoder/args-decoder";
import { Instruction } from "../instruction";
import type { MemoryOps, MoveOps } from "../ops";

export class TwoRegsDispatcher {
  constructor(
    private moveOps: MoveOps,
    private memoryOps: MemoryOps,
  ) {}

  dispatch(instruction: Instruction, args: TwoRegistersArgs) {
    switch (instruction) {
      case Instruction.MOVE_REG: {
        this.moveOps.moveRegister(args.firstRegisterIndex, args.secondRegisterIndex);
        break;
      }
      case Instruction.SBRK: {
        this.memoryOps.sbrk(args.firstRegisterIndex, args.secondRegisterIndex);
        break;
      }
    }
  }
}
