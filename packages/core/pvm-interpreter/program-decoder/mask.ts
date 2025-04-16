import { BitVec } from "@typeberry/bytes";
import { check } from "@typeberry/utils";

/**
 * Upper bound of skip function - max value of GP's skip function + 1
 */
const MAX_INSTRUCTION_DISTANCE = 25;

/**
 * Mask class is an implementation of skip function defined in GP.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/237201239801
 */
export class Mask {
  /**
   * The lookup table will have `0` at the index which corresponds to an instruction on the same index in the bytecode.
   * In case the value is non-zero it signifies the offset to the index with next instruction.
   *
   * Example:
   * ```
   * 0..1..2..3..4..5..6..7..8..9 # Indices
   * 0..2..1..0..1..0..3..2..1..0 # lookupTable forward values
   * ```
   * There are instructions at indices `0, 3, 5, 9`.
   */
  private lookupTableForward: Uint8Array;

  constructor(mask: BitVec) {
    this.lookupTableForward = this.buildLookupTableForward(mask);
  }

  isInstruction(index: number) {
    return this.lookupTableForward[index] === 0;
  }

  getNoOfBytesToNextInstruction(index: number) {
    check(index >= 0, `index (${index}) cannot be a negative number`);
    return Math.min(this.lookupTableForward[index] ?? 0, MAX_INSTRUCTION_DISTANCE);
  }

  private buildLookupTableForward(mask: BitVec) {
    const table = new Uint8Array(mask.bitLength);
    let lastInstructionOffset = 0;
    for (let i = mask.bitLength - 1; i >= 0; i--) {
      if (mask.isSet(i)) {
        lastInstructionOffset = 0;
      } else {
        lastInstructionOffset++;
      }
      table[i] = lastInstructionOffset;
    }
    return table;
  }

  static empty() {
    return new Mask(BitVec.empty(0));
  }
}
