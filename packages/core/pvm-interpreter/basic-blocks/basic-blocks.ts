import { Mask } from "../program-decoder/mask";
import { terminationInstructions } from "./is-termination-instruction";

export class BasicBlocks {
  private code: Uint8Array = new Uint8Array();
  private mask: Mask = Mask.empty();
  private basicBlocks: Map<number, boolean> = new Map();

  reset(code: Uint8Array, mask: Mask) {
    this.code = code;
    this.mask = mask;

    this.calculateBasicBlocks();
  }

  private calculateBasicBlocks() {
    this.basicBlocks = new Map();
    this.basicBlocks.set(0, true);
    const codeLength = this.code.length;

    for (let i = 0; i < codeLength; i++) {
      if (this.mask.isInstruction(i) && this.isBasicBlockTermination(i)) {
        this.basicBlocks.set(i + 1 + this.mask.getNoOfBytesToNextInstruction(i + 1), true);
      }
    }
  }

  isBeginningOfBasicBlock(index: number) {
    return this.basicBlocks.has(index);
  }

  private isBasicBlockTermination(index: number) {
    return this.mask.isInstruction(index) && terminationInstructions[this.code[index]];
  }
}
