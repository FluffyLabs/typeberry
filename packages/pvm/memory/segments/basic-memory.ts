import { ZERO } from "../memory-conts";

export class BasicMemory {
  private data = new Uint8Array();

  get length() {
    return this.data.length;
  }

  setup(bytes: Uint8Array) {
    this.data = bytes;
  }

  load(index: number, length: 1 | 2 | 4) {
    if (index < this.data.length - length) {
      return this.data.subarray(index, index + length);
    }

    if (this.data.length - length < index && index >= this.data.length) {
      // is it okay to return a result that is shorter than {length}?
      const result = new Uint8Array(length);
      const firstPart = this.data.subarray(this.data.length - length, this.data.length);
      result.fill(0);
      result.set(firstPart);
      return result;
    }

    return ZERO.subarray(0, length);
  }

  store(index: number, bytes: Uint8Array) {
    this.data.set(bytes, index);
  }

  resize(newSize: number) {
    const newData = new Uint8Array(newSize);
    newData.set(this.data);
    this.data = newData;
  }

  getMemoryDump(addressOffset: number) {
    const result: { address: number; contents: Uint8Array }[] = [];
    let currentBlock: { address: number; contents: number[] } | null = null;

    for (let i = 0; i < this.data.length; i++) {
      const value = this.data[i];
      if (value > 0) {
        if (!currentBlock) {
          currentBlock = { address: i + addressOffset, contents: [] };
        }
        currentBlock.contents.push(value);
      } else {
        if (currentBlock) {
          result.push({ ...currentBlock, contents: new Uint8Array(currentBlock?.contents) });
        }
        currentBlock = null;
      }
    }

    return result;
  }
}
