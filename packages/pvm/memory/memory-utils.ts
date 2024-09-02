import { MIN_ALLOCATION_LENGTH, PAGE_SIZE, PAGE_SIZE_SHIFT } from "./memory-consts";
import { type MemoryIndex, createMemoryIndex } from "./memory-index";
import { createPageNumber } from "./page-number";

export function alignToPageSize(length: number) {
  return PAGE_SIZE * Math.ceil(length / PAGE_SIZE);
}

export function alignToMinimalAllocationLength(length: number) {
  const minLength = Math.max(length, MIN_ALLOCATION_LENGTH);
  const alignedLength = MIN_ALLOCATION_LENGTH * Math.ceil(minLength / MIN_ALLOCATION_LENGTH);
  return Math.min(PAGE_SIZE, alignedLength);
}

export function getPageNumber(address: MemoryIndex) {
  return createPageNumber(address >>> PAGE_SIZE_SHIFT);
}

export function getStartPageIndex(address: MemoryIndex) {
  return createMemoryIndex(address & ~(PAGE_SIZE - 1));
}
