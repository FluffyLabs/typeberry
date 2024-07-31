import type { OneRegisterOneImmediateResult } from "../args-decoder/args-decoder";
import { Instruction } from "../instruction";
import type { LoadOps, StoreOps } from "../ops";

export class OneRegisterOneImmediateDispatcher {
  constructor(
    private loadOps: LoadOps,
    private storeOps: StoreOps,
  ) {}

  dispatch(instruction: Instruction, args: OneRegisterOneImmediateResult) {
    switch (instruction) {
      case Instruction.LOAD_IMM:
        this.loadOps.loadImmediate(args.firstRegisterIndex, args.immediateDecoder.getUnsigned());
        break;
      case Instruction.STORE_U8:
        this.storeOps.storeU8(args.immediateDecoder.getUnsigned(), args.firstRegisterIndex);
        break;
      case Instruction.STORE_U16:
        this.storeOps.storeU16(args.immediateDecoder.getUnsigned(), args.firstRegisterIndex);
        break;
      case Instruction.STORE_U32:
        this.storeOps.storeU32(args.immediateDecoder.getUnsigned(), args.firstRegisterIndex);
        break;
      case Instruction.LOAD_U8:
        this.loadOps.loadU8(args.immediateDecoder.getUnsigned(), args.firstRegisterIndex);
        break;
      case Instruction.LOAD_U16:
        this.loadOps.loadU16(args.immediateDecoder.getUnsigned(), args.firstRegisterIndex);
        break;
      case Instruction.LOAD_U32:
        this.loadOps.loadU32(args.immediateDecoder.getUnsigned(), args.firstRegisterIndex);
        break;
      case Instruction.LOAD_I8:
        this.loadOps.loadI8(args.immediateDecoder.getUnsigned(), args.firstRegisterIndex);
        break;
      case Instruction.LOAD_I16:
        this.loadOps.loadI16(args.immediateDecoder.getUnsigned(), args.firstRegisterIndex);
        break;
    }
  }
}
