import { PAGE_SIZE, SEGMENT_SIZE } from "./memory-conts";

export function increaseToSegmentSize(address: number) {
  // Q(x) from GP
  return SEGMENT_SIZE * Math.ceil(address / SEGMENT_SIZE);
}

export function increaseToPageSize(address: number) {
  // P(x) from GP
  return PAGE_SIZE * Math.ceil(address / PAGE_SIZE);
}
