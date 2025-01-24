import { Mask } from "../program-decoder/mask";
import { terminationInstructions } from "./is-termination-instruction";

export class BasicBlocks {
  private code: Uint8Array = new Uint8Array();
  private mask: Mask = Mask.empty();

  reset(code: Uint8Array, mask: Mask) {
    this.code = code;
    this.mask = mask;
  }

  isBeginningOfBasicBlock(index: number) {
    if (index === 0) {
      return true;
    }

    return (
      this.mask.isInstruction(index) &&
      this.isBasicBlockTermination(index - (this.mask.getNoOfBytesToPreviousInstruction(index - 1) + 1))
    );
  }

  private isBasicBlockTermination(index: number) {
    return this.mask.isInstruction(index) && terminationInstructions[this.code[index]];
  }
}
