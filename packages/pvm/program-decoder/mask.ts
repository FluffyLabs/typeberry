export class Mask {
  /**
    * The lookup table will have `0` at the index which corresponds to an instruction on the same index in the bytecode.
    * In case the value is non-zero it signifies the offset to the index with next instruction.
    *
    * Example:
    * ```
    * 0..1..2..3..4..5..6..7..8..9 # Indices
    * 0..2..1..0..1..0..3..2..1..0 # lookupTable values
    * ```
    * There are instructions at indices `0, 3, 5, 9`.
    */
  private lookupTable: Uint8Array;

  constructor(mask: Uint8Array) {
    this.lookupTable = this.buildLookupTable(mask);
  }

  isInstruction(index: number) {
    return this.lookupTable[index] === 0;
  }

  getNoOfBytesToNextInstruction(index: number) {
    if (this.isInstruction(index)) {
      const nextIndex = Math.min(index + 1, this.lookupTable.length - 1);
      return this.lookupTable[nextIndex] + 1;
    }
    return this.lookupTable[index];
  }

  private buildLookupTable(mask: Uint8Array) {
    const table = new Uint8Array(mask.length * 8);
    let lastInstructionOffset = 0;
    for (let i = mask.length - 1; i >= 0; i--) {
      let singleBitMask = 0x80;
      for (let j = 7; j >= 0; j--) {
        if ((mask[i] & singleBitMask) > 0) {
          lastInstructionOffset = 0;
        } else {
          lastInstructionOffset++;
        }
        table[i * 8 + j] = lastInstructionOffset;
        singleBitMask >>>= 1;
      }
    }
    return table;
  }
}
