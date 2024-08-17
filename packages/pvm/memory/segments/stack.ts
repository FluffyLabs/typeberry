import { ONE_MB, STACK_SEGMENT } from "../memory-conts";
import { increaseToPageSize } from "../memory-utils";
import { BasicMemory } from "./basic-memory";

export class Stack {
  private data: BasicMemory;
  private endOfStack = STACK_SEGMENT;
  private stackSize = 0;

  constructor() {
    this.data = new BasicMemory(16 * ONE_MB);
  }

  set(size: number) {
    this.stackSize = increaseToPageSize(size);
    this.endOfStack = STACK_SEGMENT - this.stackSize;
  }

  isStackAddress(address: number) {
    return address >= this.endOfStack && address < STACK_SEGMENT;
  }

  load(address: number, length: 1 | 2 | 4) {
    const index = address - this.endOfStack;
    return this.data.load(index, length);
  }

  store(address: number, bytes: Uint8Array) {
    const index = address - this.endOfStack;
    this.data.store(index, bytes);
  }

  getMemoryDump() {
    return this.data.getMemoryDump(this.endOfStack);
  }

  getPageDump(index: number) {
    return this.data.getPageDump(index, this.endOfStack);
  }
}
