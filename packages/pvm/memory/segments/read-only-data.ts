import { ONE_MB, SEGMENT_SIZE } from "../memory-conts";
import { increaseToPageSize } from "../memory-utils";
import { BasicMemory } from "./basic-memory";

export class ReadOnlyData {
  private data: BasicMemory;
  private endOfReadOnlyDataSegment = SEGMENT_SIZE;

  constructor() {
    this.data = new BasicMemory(16 * ONE_MB);
  }

  set(readOnlyData: Uint8Array) {
    this.data.set(readOnlyData);
    this.endOfReadOnlyDataSegment = SEGMENT_SIZE + increaseToPageSize(readOnlyData.length);
  }

  isReadonlyDataAddress(address: number) {
    return address >= SEGMENT_SIZE && address < this.endOfReadOnlyDataSegment;
  }

  load(address: number, length: 1 | 2 | 4) {
    const index = address - SEGMENT_SIZE;
    return this.data.load(index, length);
  }

  getMemoryDump() {
    return this.data.getMemoryDump(SEGMENT_SIZE);
  }

  getPageDump(index: number) {
    return this.data.getPageDump(index, SEGMENT_SIZE);
  }
}
