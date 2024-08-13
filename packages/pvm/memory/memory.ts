import { PageFault } from "./page-fault";
import { AdditionalReadOnlyData, Heap, ReadOnlyData, Stack } from "./segments";

export class Memory {
  private readOnlyData = new ReadOnlyData();
  private heap = new Heap();
  private stack = new Stack();
  private additionalReadOnlyData = new AdditionalReadOnlyData();

  setupMemory(readOnlyData: Uint8Array, initialHeap: Uint8Array, stackSize: number, noOfHeapPages: number) {
    this.readOnlyData.setup(readOnlyData);
    this.heap.setup(readOnlyData, initialHeap, noOfHeapPages);
    this.stack.setup(stackSize);
  }

  setupAdditionalReadOnlySegment(readOnlyData: Uint8Array) {
    this.additionalReadOnlyData.setup(readOnlyData);
  }

  sbrk(size: number) {
    return this.heap.sbrk(size);
  }

  getSegmentBasedOnAddress(address: number) {
    if (this.heap.isHeapAddress(address)) {
      return this.heap;
    }

    if (this.stack.isStackAddress(address)) {
      return this.stack;
    }

    if (this.readOnlyData.isReadonlyDataAddress(address)) {
      return this.readOnlyData;
    }

    if (this.additionalReadOnlyData.isAdditionalReadOnlyDataAddress(address)) {
      return this.additionalReadOnlyData;
    }

    throw new PageFault(address);
  }

  store(address: number, data: Uint8Array) {
    const segment = this.getSegmentBasedOnAddress(address);

    if (segment === this.heap || segment === this.stack) {
      segment.store(address, data);
      return;
    }

    throw new PageFault(address);
  }

  load(address: number, length: 1 | 2 | 4) {
    const segment = this.getSegmentBasedOnAddress(address);
    if (!segment) {
      throw new PageFault(address);
    }

    return segment.load(address, length);
  }

  getMemoryDump() {
    return [
      ...this.readOnlyData.getMemoryDump(),
      ...this.heap.getMemoryDump(),
      ...this.stack.getMemoryDump(),
      ...this.additionalReadOnlyData.getMemoryDump(),
    ];
  }
}
