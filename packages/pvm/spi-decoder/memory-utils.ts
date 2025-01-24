import { PAGE_SIZE, SEGMENT_SIZE } from "./memory-conts";

// GP reference: https://graypaper.fluffylabs.dev/#/579bd12/2bd2022bd202

export function alignToSegmentSize(size: number) {
  // Q(x) from GP
  return SEGMENT_SIZE * Math.ceil(size / SEGMENT_SIZE);
}

export function alignToPageSize(size: number) {
  // P(x) from GP
  return PAGE_SIZE * Math.ceil(size / PAGE_SIZE);
}
