export class Mask {
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
