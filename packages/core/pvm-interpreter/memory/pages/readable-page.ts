import { OK, Result } from "@typeberry/utils";
import { PageFault } from "../errors";
import { PAGE_SIZE } from "../memory-consts";
import { MemoryPage } from "./memory-page";
import type { PageIndex, PageNumber } from "./page-utils";

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
      return Result.error(new PageFault(this.start + PAGE_SIZE));
    }

    const bytes = this.data.subarray(startIndex, endIndex);
    // we zero the bytes, since data might not yet be initialized at `endIndex`.
    result.fill(0, bytes.length, length);
    result.set(bytes);

    return Result.ok(OK);
  }

  storeFrom(_address: PageIndex, _data: Uint8Array): Result<OK, PageFault> {
    return Result.error(new PageFault(0, false));
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
