import { ChunkOverlap, ChunkTooLong, PageFault } from "../errors";
import { type MemoryIndex, createMemoryIndex } from "../memory-index";
import { MemoryPage } from "./memory-page";

export const readable = Symbol("readable");
export const writeable = Symbol("writeable");

type AccessType = typeof readable | typeof writeable;

/**
 * This page is used only in case of custom memory layout (without aligment to full pages).
 * In standard cases (for example: Jam SPI or no memory loyout) it is not used.
 */
export class VirtualPage extends MemoryPage {
  private chunks: [MemoryIndex, MemoryIndex, Uint8Array, AccessType][] = [];

  set(start: MemoryIndex, end: MemoryIndex, chunk: Uint8Array, accessType: AccessType) {
    if (this.chunks.find(([s, e]) => (start <= s && s < end) || (start < e && e < end))) {
      throw new ChunkOverlap();
    }

    if (chunk.length > end - start) {
      throw new ChunkTooLong();
    }

    if (accessType === readable || chunk.length === end - start) {
      this.chunks.push([start, end, chunk, accessType]);
    } else {
      if (chunk.length > 0) {
        this.chunks.push([start, createMemoryIndex(start + chunk.length), chunk, accessType]);
      }

      // "length < end - start" and the chunk is writeable so we need to allocate zeros from "start + length" to "end"
      // to have possibility to store data from "start" to "end"
      const emptyChunk = new Uint8Array(end - start - chunk.length);
      this.chunks.push([createMemoryIndex(start + chunk.length), end, emptyChunk, accessType]);
    }
    // the chunks have to be sorted to load from / store into a few chunks
    this.chunks.sort((a, b) => a[0] - b[0]);
  }

  storeFrom(address: MemoryIndex, dataToStore: Uint8Array) {
    let storedBytes = 0;

    for (let i = 0; i < this.chunks.length && storedBytes < dataToStore.length; i++) {
      const [start, end, data, accessType] = this.chunks[i];
      while (start <= address + storedBytes && address + storedBytes < end && storedBytes < dataToStore.length) {
        if (accessType !== writeable) {
          return new PageFault(address + storedBytes);
        }

        const indexToStore = address + storedBytes - start;
        data[indexToStore] = dataToStore[storedBytes];
        storedBytes++;
      }
    }

    if (storedBytes < dataToStore.length && address + dataToStore.length < this.end) {
      return new PageFault(address + storedBytes);
    }

    return null;
  }

  loadInto(res: Uint8Array, address: MemoryIndex, length: 1 | 2 | 3 | 4) {
    let loadedLength = 0;

    for (let i = 0; i < this.chunks.length && loadedLength < length; i++) {
      const [start, end, data] = this.chunks[i];
      while (start <= address + loadedLength && address + loadedLength < end && loadedLength < length) {
        const indexToLoad = address + loadedLength - start;
        res[loadedLength] = loadedLength < data.length ? data[indexToLoad] : 0;
        loadedLength++;
      }
    }

    if (loadedLength < length && address + loadedLength < this.end) {
      return new PageFault(address + loadedLength);
    }

    return null;
  }

  sbrk(start: MemoryIndex) {
    this.set(start, this.end, new Uint8Array(this.end - start), writeable);
    return this.end - start;
  }
}
