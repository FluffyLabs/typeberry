import type { OneRegisterOneExtendedWidthImmediateArgs } from "../args-decoder/args-decoder.js";
import { Instruction } from "../instruction.js";
import type { LoadOps } from "../ops/index.js";

export class OneRegOneExtImmDispatcher {
  constructor(private loadOps: LoadOps) {}

  dispatch(instruction: Instruction, args: OneRegisterOneExtendedWidthImmediateArgs) {
    switch (instruction) {
      case Instruction.LOAD_IMM_64:
        this.loadOps.loadImmediateU64(args.registerIndex, args.immediateDecoder);
        break;
    }
  }
}
