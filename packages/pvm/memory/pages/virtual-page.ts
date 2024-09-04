import { type Opaque, ensure } from "@typeberry/utils";
import { ChunkOverlap, ChunkTooLong, PageFault } from "../errors";
import { PAGE_SIZE } from "../memory-consts";
import { MemoryPage } from "./memory-page";
import { type PageIndex, createPageIndex } from "./page-utils";

export const readable = Symbol("readable");
export const writeable = Symbol("writeable");

type AccessType = typeof readable | typeof writeable;

export type ChunkEndIndex = Opaque<number, "End of chunk index">;

/** Ensure that given memory `index` is within `0...PAGE_SIZE` and can be used to index a page */
export function createEndChunkIndex(index: number) {
  return ensure<number, ChunkEndIndex>(
    index,
    index >= 0 && index <= PAGE_SIZE,
    `Incorect end of chunk index: ${index}!`,
  );
}

/**
 * This page is used only in case of custom memory layout (without aligment to full pages).
 * In standard cases (for example: Jam SPI or no memory loyout) it is not used.
 */
export class VirtualPage extends MemoryPage {
  /**
   * [start, end, data, accessType]
   * end of chunk cannot be PageIndex as PAGE_SIZE is not a correct PageIndex
   */
  private chunks: [PageIndex, ChunkEndIndex, Uint8Array, AccessType][] = [];

  set(start: PageIndex, end: ChunkEndIndex, chunk: Uint8Array, accessType: AccessType) {
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
        this.chunks.push([start, createEndChunkIndex(start + chunk.length), chunk, accessType]);
      }

      // "length < end - start" and the chunk is writeable so we need to allocate zeros from "start + length" to "end"
      // to have possibility to store data from "start" to "end"
      const emptyChunk = new Uint8Array(end - start - chunk.length);
      this.chunks.push([createPageIndex(start + chunk.length), end, emptyChunk, accessType]);
    }
    // the chunks have to be sorted to load from / store into a few chunks
    this.chunks.sort((a, b) => a[0] - b[0]);
  }

  storeFrom(startIndex: PageIndex, dataToStore: Uint8Array) {
    // find the first chunk to load from
    let chunkIndex = this.chunks.findIndex(
      ([chunkStartIndex, chunkEndIndex]) => chunkStartIndex <= startIndex && startIndex < chunkEndIndex,
    );

    if (chunkIndex === -1) {
      return new PageFault(startIndex + this.start);
    }

    let storedBytes = 0;

    while (storedBytes < dataToStore.length) {
      // chunks do not contain the desired address
      if (chunkIndex >= this.chunks.length) {
        return new PageFault(startIndex + this.start + storedBytes);
      }

      const [startChunkPageIndex, endChunkPageIndex, data, accessType] = this.chunks[chunkIndex];

      // chunk is not writeable
      if (accessType !== writeable) {
        return new PageFault(startIndex + storedBytes);
      }

      // there is a gap between chunks
      if (startChunkPageIndex > startIndex + storedBytes) {
        return new PageFault(startIndex + storedBytes);
      }

      const startChunkIndex = startIndex - startChunkPageIndex + storedBytes;
      const spaceOnChunk = endChunkPageIndex - startIndex - storedBytes;
      const bytesToStore = dataToStore.subarray(storedBytes, storedBytes + spaceOnChunk);
      data.set(bytesToStore, startChunkIndex);
      storedBytes += bytesToStore.length;

      chunkIndex += 1;
    }

    return null;
  }

  loadInto(res: Uint8Array, startIndex: PageIndex, length: 1 | 2 | 3 | 4) {
    // find the first chunk to load from
    let chunkIndex = this.chunks.findIndex(
      ([chunkStartIndex, chunkEndIndex]) => chunkStartIndex <= startIndex && startIndex < chunkEndIndex,
    );

    if (chunkIndex === -1) {
      return new PageFault(startIndex + this.start);
    }

    let loadedLength = 0;

    while (loadedLength < length) {
      // chunks do not contain the desired address
      if (chunkIndex >= this.chunks.length) {
        return new PageFault(startIndex + this.start + loadedLength);
      }

      const [startChunkPageIndex, endChunkPageIndex, data] = this.chunks[chunkIndex];

      // there is a gap between chunks
      if (startChunkPageIndex > startIndex + loadedLength) {
        return new PageFault(startIndex + loadedLength);
      }

      const startChunkIndex = startIndex - startChunkPageIndex + loadedLength;
      const toLoad = length - loadedLength;

      const dataToLoad = data.subarray(startChunkIndex, Math.min(startChunkIndex + toLoad, data.length));
      res.set(dataToLoad, loadedLength);
      loadedLength += dataToLoad.length;

      // fill the reminder with zeros.
      if (startIndex + length < endChunkPageIndex) {
        res.fill(0, loadedLength, length);
        loadedLength = length;
      }

      chunkIndex += 1;
    }

    return null;
  }

  getPageDump() {
    const page = new Uint8Array(PAGE_SIZE);

    for (const [start, _end, chunk] of this.chunks) {
      page.set(chunk, start);
    }

    return page;
  }
}
