import type { OneRegisterTwoImmediatesArgs } from "../args-decoder/args-decoder";
import { Instruction } from "../instruction";
import type { StoreOps } from "../ops";

export class OneRegTwoImmsDispatcher {
  constructor(private storeOps: StoreOps) {}

  dispatch(instruction: Instruction, args: OneRegisterTwoImmediatesArgs) {
    switch (instruction) {
      case Instruction.STORE_IMM_IND_U8:
        this.storeOps.storeImmediateIndU8(args.registerIndex, args.firstImmediateDecoder, args.secondImmediateDecoder);
        break;
      case Instruction.STORE_IMM_IND_U16:
        this.storeOps.storeImmediateIndU16(args.registerIndex, args.firstImmediateDecoder, args.secondImmediateDecoder);
        break;
      case Instruction.STORE_IMM_IND_U32:
        this.storeOps.storeImmediateIndU32(args.registerIndex, args.firstImmediateDecoder, args.secondImmediateDecoder);
        break;
    }
  }
}
