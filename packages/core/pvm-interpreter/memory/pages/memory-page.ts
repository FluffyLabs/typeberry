import type { PageFault } from "../errors";
import type { MemoryIndex } from "../memory-index";
import { getStartPageIndexFromPageNumber } from "../memory-utils";
import type { PageIndex, PageNumber } from "./page-utils";

export abstract class MemoryPage {
  public start: MemoryIndex;

  constructor(pageNumber: PageNumber) {
    this.start = getStartPageIndexFromPageNumber(pageNumber);
  }

  /** Returns `true` if given `[pageIndex, pageStart + length)` range is writeable. */
  abstract isWriteable(pageIndex: PageIndex, length: number): boolean;

  /**
   * Load exactly `length` bytes from memory page, starting at index `address`
   * into the `res` array.
   *
   * Note that the `res` might be bigger than the number of bytes length, but cannot be smaller.
   *
   * Returns `null` if copying was successful and [`PageFault`] otherwise.
   * NOTE That the `result` might be partially modified in case `PageFault` occurs!
   */
  abstract loadInto(res: Uint8Array, address: PageIndex, length: number): null | PageFault;

  /**
   * Copy all bytes from the `data` into the page at index `address`.
   *
   * Returns `null` if copying was successful and [`PageFault`] otherwise.
   */
  abstract storeFrom(address: PageIndex, data: Uint8Array): null | PageFault;
  /**
   * Get dump of the entire page. Should only be used for the debugger-adapter because it
   * might be inefficient.
   */
  abstract getPageDump(): Uint8Array;

  abstract setData(pageIndex: PageIndex, data: Uint8Array): void;
}
