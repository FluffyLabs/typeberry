import type { TwoImmediatesArgs } from "../args-decoder/args-decoder";
import { Instruction } from "../instruction";
import type { StoreOps } from "../ops";

export class TwoImmsDispatcher {
  constructor(private storeOps: StoreOps) {}

  dispatch(instruction: Instruction, args: TwoImmediatesArgs) {
    switch (instruction) {
      case Instruction.STORE_IMM_U8:
        this.storeOps.storeImmediateU8(args.firstImmediateDecoder.getUnsigned(), args.secondImmediateDecoder);
        break;
      case Instruction.STORE_IMM_U16:
        this.storeOps.storeImmediateU16(args.firstImmediateDecoder.getUnsigned(), args.secondImmediateDecoder);
        break;
      case Instruction.STORE_IMM_U32:
        this.storeOps.storeImmediateU32(args.firstImmediateDecoder.getUnsigned(), args.secondImmediateDecoder);
        break;
        case Instruction.STORE_IMM_U64:
          this.storeOps.storeImmediateU64(args.firstImmediateDecoder.getUnsigned(), args.secondImmediateDecoder);
          break;
    }
  }
}
