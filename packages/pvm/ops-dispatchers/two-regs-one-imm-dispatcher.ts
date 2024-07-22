import type { TwoRegistersOneImmediateResult } from "../args-decoder/args-decoder";
import { Instruction } from "../instruction";
import type { BitOps } from "../ops/bit-ops";
import type { MathOps } from "../ops/math-ops";
import type { ShiftOps } from "../ops/shift-ops";

export class TwoRegsOneImmDispatcher {
  constructor(
    private mathOps: MathOps,
    private shiftOps: ShiftOps,
    private bitOps: BitOps,
  ) {}

  dispatch(instruction: Instruction, args: TwoRegistersOneImmediateResult) {
    switch (instruction) {
      case Instruction.ADD_IMM: {
        this.mathOps.addImmediate(
          args.firstRegisterIndex,
          args.immediateDecoder1.getUnsigned(),
          args.secondRegisterIndex,
        );
        break;
      }
      case Instruction.MUL_IMM: {
        this.mathOps.mulImmediate(
          args.firstRegisterIndex,
          args.immediateDecoder1.getSigned(),
          args.secondRegisterIndex,
        );
        break;
      }
      case Instruction.MUL_UPPER_U_U_IMM: {
        this.mathOps.mulImmediate(
          args.firstRegisterIndex,
          args.immediateDecoder1.getUnsigned(),
          args.secondRegisterIndex,
        );
        break;
      }
      case Instruction.MUL_UPPER_S_S_IMM: {
        this.mathOps.mulImmediate(
          args.firstRegisterIndex,
          args.immediateDecoder1.getSigned(),
          args.secondRegisterIndex,
        );
        break;
      }
      case Instruction.NEG_ADD_IMM: {
        this.mathOps.negAddImmediate(
          args.firstRegisterIndex,
          args.immediateDecoder1.getUnsigned(),
          args.secondRegisterIndex,
        );
        break;
      }
      case Instruction.SHLO_L_IMM: {
        this.shiftOps.shiftLogicalLeftImmediate(
          args.firstRegisterIndex,
          args.immediateDecoder1.getUnsigned(),
          args.secondRegisterIndex,
        );
        break;
      }
      case Instruction.SHLO_L_IMM_ALT: {
        this.shiftOps.shiftLogicalLeftImmediateAlternative(
          args.firstRegisterIndex,
          args.immediateDecoder1.getUnsigned(),
          args.secondRegisterIndex,
        );
        break;
      }
      case Instruction.SHLO_R_IMM: {
        this.shiftOps.shiftLogicalRightImmediate(
          args.firstRegisterIndex,
          args.immediateDecoder1.getUnsigned(),
          args.secondRegisterIndex,
        );
        break;
      }
      case Instruction.SHLO_R_IMM_ALT: {
        this.shiftOps.shiftLogicalRightImmediateAlternative(
          args.firstRegisterIndex,
          args.immediateDecoder1.getUnsigned(),
          args.secondRegisterIndex,
        );
        break;
      }
      case Instruction.SHAR_R_IMM: {
        this.shiftOps.shiftArithmeticRightImmediate(
          args.firstRegisterIndex,
          args.immediateDecoder1.getSigned(),
          args.secondRegisterIndex,
        );
        break;
      }
      case Instruction.SHAR_R_IMM_ALT: {
        this.shiftOps.shiftArithmeticRightImmediateAlternative(
          args.firstRegisterIndex,
          args.immediateDecoder1.getSigned(),
          args.secondRegisterIndex,
        );
        break;
      }
      case Instruction.OR_IMM: {
        this.bitOps.orImmediate(
          args.firstRegisterIndex,
          args.immediateDecoder1.getUnsigned(),
          args.secondRegisterIndex,
        );
        break;
      }
      case Instruction.AND_IMM: {
        this.bitOps.andImmediate(
          args.firstRegisterIndex,
          args.immediateDecoder1.getUnsigned(),
          args.secondRegisterIndex,
        );
        break;
      }
      case Instruction.XOR_IMM: {
        this.bitOps.xorImmediate(
          args.firstRegisterIndex,
          args.immediateDecoder1.getUnsigned(),
          args.secondRegisterIndex,
        );
        break;
      }
    }
  }
}
