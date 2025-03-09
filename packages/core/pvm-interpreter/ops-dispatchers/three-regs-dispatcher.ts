import type { ThreeRegistersArgs } from "../args-decoder/args-decoder";
import { Instruction } from "../instruction";
import type { BitOps, BitRotationOps, BooleanOps, MathOps, MoveOps, ShiftOps } from "../ops";

export class ThreeRegsDispatcher {
  constructor(
    private mathOps: MathOps,
    private shiftOps: ShiftOps,
    private bitOps: BitOps,
    private booleanOps: BooleanOps,
    private moveOps: MoveOps,
    private bitRotationOps: BitRotationOps,
  ) {}

  dispatch(instruction: Instruction, args: ThreeRegistersArgs) {
    switch (instruction) {
      case Instruction.ADD_32:
        this.mathOps.addU32(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.ADD_64:
        this.mathOps.addU64(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.MUL_32:
        this.mathOps.mulU32(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.MUL_64:
        this.mathOps.mulU64(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
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
        this.mathOps.subU32(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.SUB_64:
        this.mathOps.subU64(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.DIV_S_32:
        this.mathOps.divSignedU32(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;
      case Instruction.DIV_S_64:
        this.mathOps.divSignedU64(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.DIV_U_32:
        this.mathOps.divUnsignedU32(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;
      case Instruction.DIV_U_64:
        this.mathOps.divUnsignedU64(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.REM_S_32:
        this.mathOps.remSignedU32(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;
      case Instruction.REM_S_64:
        this.mathOps.remSignedU64(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.REM_U_32:
        this.mathOps.remUnsignedU32(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;
      case Instruction.REM_U_64:
        this.mathOps.remUnsignedU64(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.SHLO_L_32:
        this.shiftOps.shiftLogicalLeftU32(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.SHLO_L_64:
        this.shiftOps.shiftLogicalLeftU64(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.SHLO_R_32:
        this.shiftOps.shiftLogicalRightU32(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.SHLO_R_64:
        this.shiftOps.shiftLogicalRightU64(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.SHAR_R_32:
        this.shiftOps.shiftArithmeticRightU32(
          args.firstRegisterIndex,
          args.secondRegisterIndex,
          args.thirdRegisterIndex,
        );
        break;

      case Instruction.SHAR_R_64:
        this.shiftOps.shiftArithmeticRightU64(
          args.firstRegisterIndex,
          args.secondRegisterIndex,
          args.thirdRegisterIndex,
        );
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

      case Instruction.ROT_L_64:
        this.bitRotationOps.rotL64(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.ROT_L_32:
        this.bitRotationOps.rotL32(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.ROT_R_64:
        this.bitRotationOps.rotR64(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.ROT_R_32:
        this.bitRotationOps.rotR32(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.AND_INV:
        this.bitOps.andInv(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.OR_INV:
        this.bitOps.orInv(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.XNOR:
        this.bitOps.xnor(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.MAX:
        this.mathOps.max(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.MAX_U:
        this.mathOps.maxU(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;

      case Instruction.MIN:
        this.mathOps.min(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);

        break;

      case Instruction.MIN_U:
        this.mathOps.minU(args.firstRegisterIndex, args.secondRegisterIndex, args.thirdRegisterIndex);
        break;
    }
  }
}
