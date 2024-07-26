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
    }
  }

  load(address: number, length: 1 | 2 | 4): Uint8Array | null {
    const addressInPage = address % this.pageSize;
    const pageAddress = address - addressInPage;

    if (this.pageMap.isReadable(pageAddress)) {
      return this.memory.get(pageAddress)?.[addressInPage].subarray(0, length) ?? new Uint8Array(length);
    }

    return null;
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
