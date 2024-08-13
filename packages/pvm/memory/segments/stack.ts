import { STACK_SEGMENT } from "../memory-conts";
import { increaseToPageSize } from "../memory-utils";
import { BasicMemory } from "./basic-memory";

export class Stack {
  private data = new BasicMemory();
  private endOfStack = STACK_SEGMENT;

  setup(size: number) {
    const stackSize = increaseToPageSize(size);
    const stack = new Uint8Array(stackSize);
    this.data.setup(stack);
    this.endOfStack = STACK_SEGMENT - stackSize;
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
