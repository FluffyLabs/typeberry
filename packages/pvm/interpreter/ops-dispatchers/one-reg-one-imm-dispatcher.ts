import type { OneRegisterOneImmediateArgs } from "../args-decoder/args-decoder";
import { Instruction } from "../instruction";
import type { LoadOps, StoreOps } from "../ops";
import type { DynamicJumpOps } from "../ops/dynamic-jump-ops";

export class OneRegOneImmDispatcher {
  constructor(
    private loadOps: LoadOps,
    private storeOps: StoreOps,
    private dynamicJumpOps: DynamicJumpOps,
  ) {}

  dispatch(instruction: Instruction, args: OneRegisterOneImmediateArgs) {
    switch (instruction) {
      case Instruction.LOAD_IMM:
        this.loadOps.loadImmediate(args.registerIndex, args.immediateDecoder);
        break;
      case Instruction.STORE_U8:
        this.storeOps.storeU8(args.immediateDecoder.getUnsigned(), args.registerIndex);
        break;
      case Instruction.STORE_U16:
        this.storeOps.storeU16(args.immediateDecoder.getUnsigned(), args.registerIndex);
        break;
      case Instruction.STORE_U32:
        this.storeOps.storeU32(args.immediateDecoder.getUnsigned(), args.registerIndex);
        break;
      case Instruction.STORE_U64:
        this.storeOps.storeU64(args.immediateDecoder.getUnsigned(), args.registerIndex);
        break;
      case Instruction.LOAD_U8:
        this.loadOps.loadU8(args.immediateDecoder.getUnsigned(), args.registerIndex);
        break;
      case Instruction.LOAD_U16:
        this.loadOps.loadU16(args.immediateDecoder.getUnsigned(), args.registerIndex);
        break;
      case Instruction.LOAD_U32:
        this.loadOps.loadU32(args.immediateDecoder.getUnsigned(), args.registerIndex);
        break;
      case Instruction.LOAD_U64:
        this.loadOps.loadU64(args.immediateDecoder.getUnsigned(), args.registerIndex);
        break;
      case Instruction.LOAD_I8:
        this.loadOps.loadI8(args.immediateDecoder.getUnsigned(), args.registerIndex);
        break;
      case Instruction.LOAD_I16:
        this.loadOps.loadI16(args.immediateDecoder.getUnsigned(), args.registerIndex);
        break;
      case Instruction.LOAD_I32:
        this.loadOps.loadI32(args.immediateDecoder.getUnsigned(), args.registerIndex);
        break;
      case Instruction.JUMP_IND: {
        const address = this.dynamicJumpOps.caluclateJumpAddress(
          args.immediateDecoder.getUnsigned(),
          args.registerIndex,
        );
        this.dynamicJumpOps.jumpInd(address);
        break;
      }
    }
  }
}
