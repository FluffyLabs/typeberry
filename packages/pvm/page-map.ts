type Page = {
  address: number;
  length: number;
  "is-writable": boolean;
};

export class PageMap {
  private pages = new Map<number, Page>();
  private pageSize: number;

  constructor(initialPageMap: Page[]) {
    this.pageSize = initialPageMap[0]?.length ?? 0;

    for (const page of initialPageMap) {
      this.pages.set(page.address, page);
    }
  }

  isReadable(address: number) {
    const pageAddress = address - (address % this.pageSize);
    return this.pages.has(pageAddress);
  }

  isWritable(address: number) {
    const pageAddress = address - (address % this.pageSize);
    return this.pages.get(pageAddress)?.["is-writable"] === true;
  }

  getPageSize() {
    return this.pageSize;
  }
}
