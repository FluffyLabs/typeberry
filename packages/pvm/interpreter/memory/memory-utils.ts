import { PAGE_SIZE, PAGE_SIZE_SHIFT } from "./memory-consts";
import { type MemoryIndex, tryAsMemoryIndex } from "./memory-index";
import { type PageNumber, tryAsPageNumber } from "./pages/page-utils";

export function alignToPageSize(length: number) {
  return PAGE_SIZE * Math.ceil(length / PAGE_SIZE);
}

export function getPageNumber(address: MemoryIndex) {
  return tryAsPageNumber(address >>> PAGE_SIZE_SHIFT);
}

export function getStartPageIndex(address: MemoryIndex) {
  return tryAsMemoryIndex(address & ~(PAGE_SIZE - 1));
}

export function getStartPageIndexFromPageNumber(pageNumber: PageNumber) {
  // >>> 0 is needed to avoid changing sign of the number
  return tryAsMemoryIndex((pageNumber << PAGE_SIZE_SHIFT) >>> 0);
}
