import type { TwoRegistersOneImmediateArgs } from "../args-decoder/args-decoder";
import { Instruction } from "../instruction";
import type { BitOps, BitRotationOps, BooleanOps, LoadOps, MathOps, MoveOps, ShiftOps, StoreOps } from "../ops";

export class TwoRegsOneImmDispatcher {
  constructor(
    private mathOps: MathOps,
    private shiftOps: ShiftOps,
    private bitOps: BitOps,
    private booleanOps: BooleanOps,
    private moveOps: MoveOps,
    private storeOps: StoreOps,
    private loadOps: LoadOps,
    private bitRotationOps: BitRotationOps,
  ) {}

  dispatch(instruction: Instruction, args: TwoRegistersOneImmediateArgs) {
    switch (instruction) {
      case Instruction.ADD_IMM_32:
        this.mathOps.addImmediateU32(args.secondRegisterIndex, args.immediateDecoder, args.firstRegisterIndex);
        break;

      case Instruction.ADD_IMM_64:
        this.mathOps.addImmediateU64(args.secondRegisterIndex, args.immediateDecoder, args.firstRegisterIndex);
        break;

      case Instruction.MUL_IMM_32:
        this.mathOps.mulImmediateU32(args.secondRegisterIndex, args.immediateDecoder, args.firstRegisterIndex);
        break;

      case Instruction.MUL_IMM_64:
        this.mathOps.mulImmediateU64(args.secondRegisterIndex, args.immediateDecoder, args.firstRegisterIndex);
        break;

      case Instruction.NEG_ADD_IMM_32:
        this.mathOps.negAddImmediateU32(args.secondRegisterIndex, args.immediateDecoder, args.firstRegisterIndex);
        break;

      case Instruction.NEG_ADD_IMM_64:
        this.mathOps.negAddImmediateU64(args.secondRegisterIndex, args.immediateDecoder, args.firstRegisterIndex);
        break;

      case Instruction.SHLO_L_IMM_32:
        this.shiftOps.shiftLogicalLeftImmediateU32(
          args.secondRegisterIndex,
          args.immediateDecoder,
          args.firstRegisterIndex,
        );
        break;

      case Instruction.SHLO_L_IMM_64:
        this.shiftOps.shiftLogicalLeftImmediateU64(
          args.secondRegisterIndex,
          args.immediateDecoder,
          args.firstRegisterIndex,
        );
        break;

      case Instruction.SHLO_L_IMM_ALT_32:
        this.shiftOps.shiftLogicalLeftImmediateAlternativeU32(
          args.secondRegisterIndex,
          args.immediateDecoder,
          args.firstRegisterIndex,
        );
        break;

      case Instruction.SHLO_L_IMM_ALT_64:
        this.shiftOps.shiftLogicalLeftImmediateAlternativeU64(
          args.secondRegisterIndex,
          args.immediateDecoder,
          args.firstRegisterIndex,
        );
        break;

      case Instruction.SHLO_R_IMM_32:
        this.shiftOps.shiftLogicalRightImmediateU32(
          args.secondRegisterIndex,
          args.immediateDecoder,
          args.firstRegisterIndex,
        );
        break;

      case Instruction.SHLO_R_IMM_64:
        this.shiftOps.shiftLogicalRightImmediateU64(
          args.secondRegisterIndex,
          args.immediateDecoder,
          args.firstRegisterIndex,
        );
        break;

      case Instruction.SHLO_R_IMM_ALT_32:
        this.shiftOps.shiftLogicalRightImmediateAlternativeU32(
          args.secondRegisterIndex,
          args.immediateDecoder,
          args.firstRegisterIndex,
        );
        break;

      case Instruction.SHLO_R_IMM_ALT_64:
        this.shiftOps.shiftLogicalRightImmediateAlternativeU64(
          args.secondRegisterIndex,
          args.immediateDecoder,
          args.firstRegisterIndex,
        );
        break;

      case Instruction.SHAR_R_IMM_32:
        this.shiftOps.shiftArithmeticRightImmediateU32(
          args.secondRegisterIndex,
          args.immediateDecoder,
          args.firstRegisterIndex,
        );
        break;

      case Instruction.SHAR_R_IMM_64:
        this.shiftOps.shiftArithmeticRightImmediateU64(
          args.secondRegisterIndex,
          args.immediateDecoder,
          args.firstRegisterIndex,
        );
        break;

      case Instruction.SHAR_R_IMM_ALT_32:
        this.shiftOps.shiftArithmeticRightImmediateAlternativeU32(
          args.secondRegisterIndex,
          args.immediateDecoder,
          args.firstRegisterIndex,
        );
        break;

      case Instruction.SHAR_R_IMM_ALT_64:
        this.shiftOps.shiftArithmeticRightImmediateAlternativeU64(
          args.secondRegisterIndex,
          args.immediateDecoder,
          args.firstRegisterIndex,
        );
        break;

      case Instruction.OR_IMM:
        this.bitOps.orImmediate(args.secondRegisterIndex, args.immediateDecoder, args.firstRegisterIndex);
        break;

      case Instruction.AND_IMM:
        this.bitOps.andImmediate(args.secondRegisterIndex, args.immediateDecoder, args.firstRegisterIndex);
        break;

      case Instruction.XOR_IMM:
        this.bitOps.xorImmediate(args.secondRegisterIndex, args.immediateDecoder, args.firstRegisterIndex);
        break;

      case Instruction.SET_LT_S_IMM:
        this.booleanOps.setLessThanSignedImmediate(
          args.secondRegisterIndex,
          args.immediateDecoder,
          args.firstRegisterIndex,
        );
        break;

      case Instruction.SET_LT_U_IMM:
        this.booleanOps.setLessThanUnsignedImmediate(
          args.secondRegisterIndex,
          args.immediateDecoder,
          args.firstRegisterIndex,
        );
        break;

      case Instruction.SET_GT_S_IMM:
        this.booleanOps.setGreaterThanSignedImmediate(
          args.secondRegisterIndex,
          args.immediateDecoder,
          args.firstRegisterIndex,
        );
        break;

      case Instruction.SET_GT_U_IMM:
        this.booleanOps.setGreaterThanUnsignedImmediate(
          args.secondRegisterIndex,
          args.immediateDecoder,
          args.firstRegisterIndex,
        );
        break;

      case Instruction.CMOV_IZ_IMM:
        this.moveOps.cmovIfZeroImmediate(args.secondRegisterIndex, args.immediateDecoder, args.firstRegisterIndex);
        break;

      case Instruction.CMOV_NZ_IMM:
        this.moveOps.cmovIfNotZeroImmediate(args.secondRegisterIndex, args.immediateDecoder, args.firstRegisterIndex);
        break;

      case Instruction.STORE_IND_U8:
        this.storeOps.storeIndU8(args.firstRegisterIndex, args.secondRegisterIndex, args.immediateDecoder);
        break;

      case Instruction.STORE_IND_U16:
        this.storeOps.storeIndU16(args.firstRegisterIndex, args.secondRegisterIndex, args.immediateDecoder);
        break;

      case Instruction.STORE_IND_U32:
        this.storeOps.storeIndU32(args.firstRegisterIndex, args.secondRegisterIndex, args.immediateDecoder);
        break;

      case Instruction.STORE_IND_U64:
        this.storeOps.storeIndU64(args.firstRegisterIndex, args.secondRegisterIndex, args.immediateDecoder);
        break;

      case Instruction.LOAD_IND_U8:
        this.loadOps.loadIndU8(args.firstRegisterIndex, args.secondRegisterIndex, args.immediateDecoder);
        break;

      case Instruction.LOAD_IND_U16:
        this.loadOps.loadIndU16(args.firstRegisterIndex, args.secondRegisterIndex, args.immediateDecoder);
        break;

      case Instruction.LOAD_IND_U32:
        this.loadOps.loadIndU32(args.firstRegisterIndex, args.secondRegisterIndex, args.immediateDecoder);
        break;

      case Instruction.LOAD_IND_U64:
        this.loadOps.loadIndU64(args.firstRegisterIndex, args.secondRegisterIndex, args.immediateDecoder);
        break;

      case Instruction.LOAD_IND_I8:
        this.loadOps.loadIndI8(args.firstRegisterIndex, args.secondRegisterIndex, args.immediateDecoder);
        break;

      case Instruction.LOAD_IND_I16:
        this.loadOps.loadIndI16(args.firstRegisterIndex, args.secondRegisterIndex, args.immediateDecoder);
        break;

      case Instruction.LOAD_IND_I32:
        this.loadOps.loadIndI32(args.firstRegisterIndex, args.secondRegisterIndex, args.immediateDecoder);
        break;

      case Instruction.ROT_R_64_IMM:
        this.bitRotationOps.rotR64Imm(args.secondRegisterIndex, args.immediateDecoder, args.firstRegisterIndex);
        break;

      case Instruction.ROT_R_64_IMM_ALT:
        this.bitRotationOps.rotR64ImmAlt(args.secondRegisterIndex, args.immediateDecoder, args.firstRegisterIndex);
        break;

      case Instruction.ROT_R_32_IMM:
        this.bitRotationOps.rotR32Imm(args.secondRegisterIndex, args.immediateDecoder, args.firstRegisterIndex);
        break;

      case Instruction.ROT_R_32_IMM_ALT:
        this.bitRotationOps.rotR32ImmAlt(args.secondRegisterIndex, args.immediateDecoder, args.firstRegisterIndex);
        break;
    }
  }
}
