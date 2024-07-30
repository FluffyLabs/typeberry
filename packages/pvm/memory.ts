import type { PageMap } from "./page-map";

type MemoryChunkItem = {
  address: number;
  contents: Uint8Array;
};

export class Memory {
  private memory = new Map<number, Uint8Array[]>();
  private pageSize: number;

  constructor(
    private pageMap: PageMap,
    initialMemory: MemoryChunkItem[],
  ) {
    this.pageSize = pageMap.getPageSize();

    for (const { address, contents } of initialMemory) {
      const addressInPage = address % this.pageSize;
      const pageAddress = address - addressInPage;
      const page = new Array<Uint8Array>(this.pageSize);
      page[addressInPage] = contents;
      this.memory.set(pageAddress, page);
    }
  }

  store(address: number, bytes: Uint8Array) {
    const addressInPage = address % this.pageSize;
    const pageAddress = address - addressInPage;

    if (this.pageMap.isWritable(pageAddress)) {
      const hasPage = this.memory.has(pageAddress);
      const page = this.memory.get(pageAddress) ?? new Array<Uint8Array>(this.pageSize);
      page[addressInPage] = bytes;
      if (!hasPage) {
        this.memory.set(pageAddress, page);
      }
    } else {
      // TODO [MaSi]: it should be a page fault
    }
  }

  load(address: number, length: 1 | 2 | 4): Uint8Array | null {
    const addressInPage = address % this.pageSize;
    const pageAddress = address - addressInPage;

    if (this.pageMap.isReadable(pageAddress)) {
      const value = this.memory.get(pageAddress)?.[addressInPage];
      if (value) {
        return value.subarray(0, length);
      }
      const bytes = new Uint8Array(4);
      this.store(address, bytes);
      return bytes.subarray(0, length);
    }

    return null; // TODO [MaSi]: it should be a page fault
  }

  getMemoryDump() {
    const dump: { address: number; contents: number[] }[] = [];

    for (const [address, page] of this.memory.entries()) {
      for (let i = 0; i < page.length; i++) {
        if (page[i]?.some((bytes) => bytes > 0)) {
          dump.push({
            address: address + i,
            contents: Array.from(page[i]),
          });
        }
      }
    }

    return dump;
  }
}
