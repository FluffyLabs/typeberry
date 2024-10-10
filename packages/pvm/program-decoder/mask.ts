import type { BitVec } from "@typeberry/bytes";
import { check } from "@typeberry/utils";
export class Mask {
  /**
   * The lookup table will have `0` at the index which corresponds to an instruction on the same index in the bytecode.
   * In case the value is non-zero it signifies the offset to the index with next instruction.
   *
   * Example:
   * ```
   * 0..1..2..3..4..5..6..7..8..9 # Indices
   * 0..2..1..0..1..0..3..2..1..0 # lookupTable forward values
   * 0..1..2..0..1..0..1..2..3..0 # lookupTable backward values
   * ```
   * There are instructions at indices `0, 3, 5, 9`.
   */
  private lookupTableForward: Uint8Array;
  private lookupTableBackward: Uint8Array;

  constructor(mask: BitVec) {
    this.lookupTableForward = this.buildLookupTableForward(mask);
    this.lookupTableBackward = this.buildLookupTableBackward(mask);
  }

  isInstruction(index: number) {
    return this.lookupTableForward[index] === 0;
  }

  getNoOfBytesToNextInstruction(index: number) {
    check(index >= 0, `index (${index}) cannot be a negative number`);
    return this.lookupTableForward[index] ?? 0;
  }

  getNoOfBytesToPreviousInstruction(index: number) {
    check(index >= 0, `index (${index}) cannot be a negative number`);
    check(
      index < this.lookupTableBackward.length,
      `index (${index}) cannot be bigger than ${this.lookupTableBackward.length - 1}`,
    );
    return this.lookupTableBackward[index];
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

  private buildLookupTableBackward(mask: BitVec) {
    const table = new Uint8Array(mask.bitLength);
    let lastInstructionOffset = 0;
    for (let i = 0; i < mask.bitLength; i++) {
      if (mask.isSet(i)) {
        lastInstructionOffset = 0;
      } else {
        lastInstructionOffset++;
      }
      table[i] = lastInstructionOffset;
    }
    return table;
  }
}
