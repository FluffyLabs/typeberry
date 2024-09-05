import { PAGE_SIZE, PAGE_SIZE_SHIFT } from "./memory-consts";
import { type MemoryIndex, createMemoryIndex } from "./memory-index";
import { type PageNumber, createPageNumber } from "./pages/page-utils";

export function alignToPageSize(length: number) {
  return PAGE_SIZE * Math.ceil(length / PAGE_SIZE);
}

export function getPageNumber(address: MemoryIndex) {
  return createPageNumber(address >>> PAGE_SIZE_SHIFT);
}

export function getStartPageIndex(address: MemoryIndex) {
  return createMemoryIndex(address & ~(PAGE_SIZE - 1));
}

export function getStartPageIndexFromPageNumber(pageNumber: PageNumber) {
  // >>> 0 is needed to avoid changing sign of the number
  return createMemoryIndex((pageNumber << PAGE_SIZE_SHIFT) >>> 0);
}
