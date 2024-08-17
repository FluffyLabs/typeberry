import { ONE_MB, STACK_SEGMENT } from "../memory-conts";
import { increaseToPageSize } from "../memory-utils";
import { BasicMemory } from "./basic-memory";

export class AdditionalReadOnlyData {
  private data: BasicMemory;
  private endOfSegment = STACK_SEGMENT;

  constructor() {
    this.data = new BasicMemory(16 * ONE_MB);
  }

  set(additionalReadOnlyData: Uint8Array) {
    this.data.set(additionalReadOnlyData);
    this.endOfSegment = STACK_SEGMENT + increaseToPageSize(additionalReadOnlyData.length);
  }

  isAdditionalReadOnlyDataAddress(address: number) {
    return address >= STACK_SEGMENT && address < this.endOfSegment;
  }

  load(address: number, length: 1 | 2 | 4) {
    const index = address - STACK_SEGMENT;
    return this.data.load(index, length);
  }

  getMemoryDump() {
    return this.data.getMemoryDump(STACK_SEGMENT);
  }

  getPageDump(index: number) {
    return this.data.getPageDump(index, STACK_SEGMENT);
  }
}
