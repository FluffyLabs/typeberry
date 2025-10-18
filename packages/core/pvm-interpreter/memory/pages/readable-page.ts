import { OK, Result } from "@typeberry/utils";
import { PageFault } from "../errors.js";
import { PAGE_SIZE } from "../memory-consts.js";
import { MemoryPage } from "./memory-page.js";
import type { PageIndex, PageNumber } from "./page-utils.js";

export class ReadablePage extends MemoryPage {
  constructor(
    pageNumber: PageNumber,
    private data: Uint8Array,
  ) {
    super(pageNumber);
  }

  loadInto(result: Uint8Array, startIndex: PageIndex, length: number): Result<OK, PageFault> {
    const endIndex = startIndex + length;
    if (endIndex > PAGE_SIZE) {
      return Result.error(
        PageFault.fromMemoryIndex(this.start + PAGE_SIZE),
        () => `Page fault: read beyond page boundary at ${this.start + PAGE_SIZE}`,
      );
    }

    const bytes = this.data.subarray(startIndex, endIndex);
    // we zero the bytes, since data might not yet be initialized at `endIndex`.
    result.fill(0, bytes.length, length);
    result.set(bytes);

    return Result.ok(OK);
  }

  storeFrom(_address: PageIndex, _data: Uint8Array): Result<OK, PageFault> {
    return Result.error(
      PageFault.fromMemoryIndex(this.start, true),
      () => `Page fault: attempted to write to read-only page at ${this.start}`,
    );
  }

  setData(pageIndex: PageIndex, data: Uint8Array) {
    this.data.set(data, pageIndex);
  }

  isWriteable() {
    return false;
  }

  getPageDump() {
    return this.data;
  }
}
