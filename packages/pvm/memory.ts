import type { PageMap } from "./page-map";

type MemoryChunkItem = {
  address: number;
  contents: Uint8Array;
};

const ZERO = new Uint8Array(4);
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

  isWritable(address: number) {
    const addressInPage = address % this.pageSize;
    const pageAddress = address - addressInPage;
    return this.pageMap.isWritable(pageAddress);
  }

  isReadable(address: number) {
    const addressInPage = address % this.pageSize;
    const pageAddress = address - addressInPage;
    return this.pageMap.isReadable(pageAddress);
  }

  store(address: number, bytes: Uint8Array) {
    const addressInPage = address % this.pageSize;
    const pageAddress = address - addressInPage;
    const hasPage = this.memory.has(pageAddress);
    const page = this.memory.get(pageAddress) ?? new Array<Uint8Array>(this.pageSize);
    page[addressInPage] = bytes;
    if (!hasPage) {
      this.memory.set(pageAddress, page);
    }
  }

  load(address: number, length: 1 | 2 | 4): Uint8Array {
    const addressInPage = address % this.pageSize;
    const pageAddress = address - addressInPage;

    const value = this.memory.get(pageAddress)?.[addressInPage] ?? ZERO;
    return value.subarray(0, length);
  }

  getPageDump(pageNumber: number) {
    // TODO [MaSi]: It is a temporary solution to unlock the tooling team, the function is not used from PVM. The implementation needs more love
    const page = this.memory.get(pageNumber);
    if (!page) {
      return null;
    }
    const flatPage = page.map((x) => x ?? ZERO).reduce((acc, item) => acc.concat(...item), [] as number[]);
    return new Uint8Array(flatPage);
  }

  getMemoryDump() {
    const dump: { address: number; contents: Uint8Array }[] = [];

    for (const [address, page] of this.memory.entries()) {
      for (let i = 0; i < page.length; i++) {
        if (page[i]?.some((bytes) => bytes > 0)) {
          dump.push({
            address: address + i,
            contents: page[i],
          });
        }
      }
    }

    return dump;
  }
}
