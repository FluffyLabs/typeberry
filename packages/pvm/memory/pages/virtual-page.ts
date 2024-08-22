import { check } from "@typeberry/utils";
import type { MemoryIndex } from "../memory-address";
import { PageFault } from "../page-fault";
import { MemoryPage } from "./memory-page";

export const readable = Symbol("readable");
export const writeable = Symbol("writeable");

type AccessType = typeof readable | typeof writeable;

export class VirtualPage extends MemoryPage {
  private chunks: [MemoryIndex, MemoryIndex, Uint8Array, AccessType][] = [];

  set(start: MemoryIndex, end: MemoryIndex, chunk: Uint8Array, accessType: AccessType) {
    check(!!this.chunks.find(([s, e]) => (start >= s && start < end) || (end >= s && end < e)), "chunk overlap");
    if (accessType === writeable && chunk.length < end - start + 1) {
      const newChunk = new Uint8Array(end - start + 1);
      newChunk.set(chunk);
      this.chunks.push([start, end, newChunk, accessType]);
    } else {
      this.chunks.push([start, end, chunk, accessType]);
    }
  }

  storeFrom(address: MemoryIndex, data: Uint8Array) {
    let i = 0;
    const storedBytes = 0;

    while (i < this.chunks.length) {
      const [start, _end, data, accessType] = this.chunks[i];

      if (start <= address) {
        if (accessType !== writeable) {
          return new PageFault(address);
        }

        while (storedBytes < data.length && address - start + storedBytes < data.length) {
          data[address - start + storedBytes] = data[storedBytes];
        }
      }

      i++;
    }

    if (storedBytes < data.length && address + data.length < this.end) {
      return new PageFault(address + storedBytes);
    }
  }

  loadInto(res: Uint8Array, address: MemoryIndex, length: 1 | 2 | 3 | 4) {
    let loadedLength = 0;
    let i = 0;

    while (i < this.chunks.length && loadedLength < length) {
      const [start, end, data] = this.chunks[i];

      while (start <= address + loadedLength && address + loadedLength < end && loadedLength < length) {
        res[loadedLength] = loadedLength < data.length ? data[address + loadedLength] : 0;
        loadedLength++;
      }

      i++;
    }
  }
}
