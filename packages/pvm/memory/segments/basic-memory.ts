import { PAGE_SIZE, ZERO } from "../memory-conts";

export const MUTABLE_ZERO = new Uint8Array([0, 0, 0, 0]); // to avoid allocation

export class BasicMemory {
  private data = new Uint8Array();

  get length() {
    return this.data.length;
  }

  setup(bytes: Uint8Array) {
    this.data = bytes;
  }

  load(index: number, length: 1 | 2 | 4) {
    if (index + length <= this.data.length) {
      return this.data.subarray(index, index + length);
    }

    if (index < this.data.length && index + length >= this.data.length) {
      const result = MUTABLE_ZERO;
      const firstPart = this.data.subarray(index, this.data.length);
      result.set(firstPart);
      result.fill(0, firstPart.length, length);
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

    if (currentBlock) {
      result.push({ ...currentBlock, contents: new Uint8Array(currentBlock?.contents) });
    }

    return result;
  }

  getPageDump(pageIndex: number, addressOffset: number) {
    const index = pageIndex * PAGE_SIZE - addressOffset;
    return this.data.subarray(index, index + PAGE_SIZE);
  }
}
