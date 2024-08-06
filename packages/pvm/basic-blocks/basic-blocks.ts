import type { Mask } from "../program-decoder/mask";
import { terminationInstructions } from "./is-termination-instruction";

export class BasicBlocks {
  constructor(
    private code: Uint8Array,
    private mask: Mask,
  ) {}

  isBeginningOfBasicBlock(index: number) {
    if (index === 0) {
      return true;
    }

    return this.isBasicBlockTermination(index - 1) && this.mask.isInstruction(index);
  }

  private isBasicBlockTermination(index: number) {
    return this.mask.isInstruction(index) && terminationInstructions[this.code[index]];
  }
}
