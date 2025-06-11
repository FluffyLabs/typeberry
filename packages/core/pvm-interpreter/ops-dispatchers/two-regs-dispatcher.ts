import type { TwoRegistersArgs } from "../args-decoder/args-decoder.js";
import { Instruction } from "../instruction.js";
import type { BitOps, BitRotationOps, MemoryOps, MoveOps } from "../ops/index.js";

export class TwoRegsDispatcher {
  constructor(
    private moveOps: MoveOps,
    private memoryOps: MemoryOps,
    private bitOps: BitOps,
    private bitRotationOps: BitRotationOps,
  ) {}

  dispatch(instruction: Instruction, args: TwoRegistersArgs) {
    switch (instruction) {
      case Instruction.MOVE_REG:
        this.moveOps.moveRegister(args.firstRegisterIndex, args.secondRegisterIndex);
        break;

      case Instruction.SBRK:
        this.memoryOps.sbrk(args.firstRegisterIndex, args.secondRegisterIndex);
        break;

      case Instruction.COUNT_SET_BITS_64:
        this.bitOps.countSetBits64(args.firstRegisterIndex, args.secondRegisterIndex);
        break;

      case Instruction.COUNT_SET_BITS_32:
        this.bitOps.countSetBits32(args.firstRegisterIndex, args.secondRegisterIndex);
        break;

      case Instruction.LEADING_ZERO_BITS_64:
        this.bitOps.leadingZeroBits64(args.firstRegisterIndex, args.secondRegisterIndex);
        break;

      case Instruction.LEADING_ZERO_BITS_32:
        this.bitOps.leadingZeroBits32(args.firstRegisterIndex, args.secondRegisterIndex);
        break;

      case Instruction.TRAILING_ZERO_BITS_64:
        this.bitOps.trailingZeroBits64(args.firstRegisterIndex, args.secondRegisterIndex);
        break;

      case Instruction.TRAILING_ZERO_BITS_32:
        this.bitOps.trailingZeroBits32(args.firstRegisterIndex, args.secondRegisterIndex);
        break;

      case Instruction.SIGN_EXTEND_8:
        this.bitOps.signExtend8(args.firstRegisterIndex, args.secondRegisterIndex);
        break;

      case Instruction.SIGN_EXTEND_16:
        this.bitOps.signExtend16(args.firstRegisterIndex, args.secondRegisterIndex);
        break;

      case Instruction.ZERO_EXTEND_16:
        this.bitOps.zeroExtend16(args.firstRegisterIndex, args.secondRegisterIndex);
        break;

      case Instruction.REVERSE_BYTES:
        this.bitRotationOps.reverseBytes(args.firstRegisterIndex, args.secondRegisterIndex);
        break;
    }
  }
}
