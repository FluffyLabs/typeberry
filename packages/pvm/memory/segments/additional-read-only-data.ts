import { STACK_SEGMENT } from "../memory-conts";
import { increaseToPageSize } from "../memory-utils";
import { BasicMemory } from "./basic-memory";

export class AdditionalReadOnlyData {
  private data = new BasicMemory();
  private endOfSegment = STACK_SEGMENT;

  setup(additionalReadOnlyData: Uint8Array) {
    this.data.setup(additionalReadOnlyData);
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
}
