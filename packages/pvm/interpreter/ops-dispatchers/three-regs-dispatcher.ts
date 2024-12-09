import type { ThreeRegistersArgs } from "../args-decoder/args-decoder";
import { Instruction } from "../instruction";
import type { BitOps, BooleanOps, MathOps, MoveOps, ShiftOps } from "../ops";

export class ThreeRegsDispatcher {
  constructor(
    private mathOps: MathOps,
    private shiftOps: ShiftOps,
    private bitOps: BitOps,
    private booleanOps: BooleanOps,
    private moveOps: MoveOps,
  ) {}

  dispatch(instruction: Instruction, args: ThreeRegistersArgs) {
    switch (instruction) {
      case Instruction.ADD_32:
      case Instruction.ADD_64:
        this.mathOps.add(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.MUL_32:
      case Instruction.MUL_64:
        this.mathOps.mul(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.MUL_UPPER_U_U:
        this.mathOps.mulUpperUU(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.MUL_UPPER_S_S:
        this.mathOps.mulUpperSS(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.MUL_UPPER_S_U:
        this.mathOps.mulUpperSU(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.SUB_32:
      case Instruction.SUB_64:
        this.mathOps.sub(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.DIV_S_32:
      case Instruction.DIV_S_64:
        this.mathOps.divSigned(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.DIV_U_32:
      case Instruction.DIV_U_64:
        this.mathOps.divUnsigned(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.REM_S_32:
      case Instruction.REM_S_64:
        this.mathOps.remSigned(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.REM_U_32:
      case Instruction.REM_U_64:
        this.mathOps.remUnsigned(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.SHLO_L_32:
      case Instruction.SHLO_L_64:
        this.shiftOps.shiftLogicalLeft(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.SHLO_R_32:
      case Instruction.SHLO_R_64:
        this.shiftOps.shiftLogicalRight(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.SHAR_R_32:
      case Instruction.SHAR_R_64:
        this.shiftOps.shiftArithmeticRight(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.OR:
        this.bitOps.or(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.AND:
        this.bitOps.and(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.XOR:
        this.bitOps.xor(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.SET_LT_S:
        this.booleanOps.setLessThanSigned(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.SET_LT_U:
        this.booleanOps.setLessThanUnsigned(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.CMOV_IZ:
        this.moveOps.cmovIfZero(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;
      case Instruction.CMOV_NZ:
        this.moveOps.cmovIfNotZero(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;
    }
  }
}
