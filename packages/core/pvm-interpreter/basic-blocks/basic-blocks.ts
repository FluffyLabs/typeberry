import type { Mask } from "../program-decoder/mask.js";
import { terminationInstructions } from "./is-termination-instruction.js";

export class BasicBlocks {
  private basicBlocks: Set<number> = new Set();

  reset(code: Uint8Array, mask: Mask) {
    this.basicBlocks.clear();
    this.basicBlocks.add(0);
    const codeLength = code.length;

    const isBasicBlockTermination = (index: number) =>
      mask.isInstruction(index) && terminationInstructions[code[index]];

    for (let i = 0; i < codeLength; i++) {
      if (mask.isInstruction(i) && isBasicBlockTermination(i)) {
        this.basicBlocks.add(i + 1 + mask.getNoOfBytesToNextInstruction(i + 1));
      }
    }
  }

  isBeginningOfBasicBlock(index: number) {
    return this.basicBlocks.has(index);
  }
}
