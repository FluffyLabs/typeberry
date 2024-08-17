import { PAGE_SIZE } from "../memory-conts";

export class BasicMemory {
  private data: Uint8Array;

  constructor(initialSize: number) {
    const buffer = new ArrayBuffer(initialSize);
    this.data = new Uint8Array(buffer);
  }

  set(bytes: Uint8Array) {
    this.data.set(bytes);
  }

  load(index: number, length: 1 | 2 | 4) {
    return this.data.subarray(index, index + length);
  }

  store(index: number, bytes: Uint8Array) {
    this.data.set(bytes, index);
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
