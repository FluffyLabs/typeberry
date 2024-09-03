import { ChunkOverlap, ChunkTooLong, PageFault } from "../errors";
import { PAGE_SIZE } from "../memory-consts";
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

    for (let i = 0; i < this.chunks.length; i++) {
      const [start, end, data, accessType] = this.chunks[i];
      while (start <= address + storedBytes && address + storedBytes < end && storedBytes < dataToStore.length) {
        if (accessType !== writeable) {
          return new PageFault(address + storedBytes);
        }

        const indexToStore = address + storedBytes - start;
        data[indexToStore] = dataToStore[storedBytes];
        storedBytes++;
      }
      if (storedBytes >= dataToStore.length) {
        break;
      }
    }

    if (storedBytes < dataToStore.length && address + dataToStore.length < this.end) {
      return new PageFault(address + storedBytes);
    }

    return null;
  }

  loadInto(res: Uint8Array, address: MemoryIndex, length: 1 | 2 | 3 | 4) {
    // find the first chunk to load from
    const chunk = this.chunks.findIndex((chunk, idx) => chunk.start < address);
    if (chunk === -1) {
      return new PageFault(address);
    }

    let loadedLength = 0;
    while (loadedLength < length) {
      const [start, end, data] = this.chunks[chunk];

      // this below could be collapsed into a few lines, but I think
      // it's more readable that way.
      if (loadedLength + data.length <= length) {
        // we can fit the whole chunk's data
        res.set(data, loadedLength);
        loadedLength += data.length;
      } else {
        // or we just need the remaining portion
        res.set(data.subarray(0, length - loadedLength), loadedLength);
        loadedLength += data.length;
      }

      // fill the reminder with zeros.
      if (address + length < end) {
        res.fill(0, loadedLength, length);
        loadedLength = length;
      }

      // we run out of chunks to load from
      if (chunk >= this.chunks.length) {
        return new PageFault(address + loadedLength);
      }
    }
  }

  sbrk(start: MemoryIndex) {
    this.set(start, this.end, new Uint8Array(this.end - start), writeable);
    return this.end - start;
  }

  getPageDump() {
    const page = new Uint8Array(PAGE_SIZE);

    for (const [start, _end, chunk] of this.chunks) {
      page.set(chunk, start - this.start);
    }

    return page;
  }
}
