import { PAGE_SIZE, SEGMENT_SIZE } from "../memory-conts";
import { increaseToPageSize, increaseToSegmentSize } from "../memory-utils";
import { BasicMemory } from "./basic-memory";

export class Heap {
  private data = new BasicMemory();
  private beginnigOfHeap = 2 * SEGMENT_SIZE;
  private endOfHeap = 0;

  setup(readOnlyData: Uint8Array, initialHeap: Uint8Array, noOfHeapPages: number) {
    const heapSize = increaseToPageSize(initialHeap.length);
    const heap = new Uint8Array(heapSize);
    heap.set(initialHeap);
    this.data.setup(heap);
    this.beginnigOfHeap = 2 * SEGMENT_SIZE + increaseToSegmentSize(readOnlyData.length);
    this.endOfHeap =
      2 * SEGMENT_SIZE + increaseToSegmentSize(readOnlyData.length) + heapSize + noOfHeapPages * PAGE_SIZE;
  }

  isHeapAddress(address: number) {
    return address >= this.beginnigOfHeap && address < this.endOfHeap;
  }

  sbrk(size: number) {
    const currentHeapSize = this.data.length;
    const newHeapSize = size + currentHeapSize; // can overflow

    if (newHeapSize >= this.endOfHeap) {
      // OoM
    }

    if (newHeapSize > this.beginnigOfHeap + this.data.length) {
      this.data.resize(increaseToPageSize(newHeapSize));
    }

    return currentHeapSize;
  }

  load(address: number, length: 1 | 2 | 4) {
    const index = address - this.beginnigOfHeap;
    return this.data.load(index, length);
  }

  store(address: number, data: Uint8Array) {
    const index = address - this.beginnigOfHeap;
    this.data.store(index, data);
  }

  getMemoryDump() {
    return this.data.getMemoryDump(this.beginnigOfHeap);
  }
}
