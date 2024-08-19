import { PAGE_SIZE, SEGMENT_SIZE } from "./memory-conts";

// GP references: https://graypaper.fluffylabs.dev/#WyIxYjA4MWZlM2U3IiwiMjciLG51bGwsbnVsbCxbIjxkaXYgY2xhc3M9XCJ0IG0wIHhhYSBoYiB5MTU0NCBmZjE2IGZzMCBmYzAgc2MwIGxzMCB3czBcIj4iLCI8ZGl2IGNsYXNzPVwidCBtMCB4ZTggaGUgeTE1NDkgZmYxMiBmczAgZmMwIHNjMCBsczAgd3MwXCI+Il1d

export function increaseToSegmentSize(size: number) {
  // Q(x) from GP
  return SEGMENT_SIZE * Math.ceil(size / SEGMENT_SIZE);
}

export function increaseToPageSize(size: number) {
  // P(x) from GP
  return PAGE_SIZE * Math.ceil(size / PAGE_SIZE);
}
