import assert from "node:assert";
import { describe, it } from "node:test";
import { ChunkOverlap, ChunkTooLong, PageFault } from "../errors";
import { PAGE_SIZE } from "../memory-consts";
import { tryAsMemoryIndex } from "../memory-index";
import { tryAsPageIndex, tryAsPageNumber } from "./page-utils";
import { VirtualPage, createEndChunkIndex, readable, writeable } from "./virtual-page";

describe("VirtualPage", () => {
  it("should throw an error when chunks overlap each other", () => {
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);

    virtualPage.set(tryAsPageIndex(5), createEndChunkIndex(10), new Uint8Array(), readable);
    const tryToSetOverlapingChunk = () =>
      virtualPage.set(tryAsPageIndex(8), createEndChunkIndex(12), new Uint8Array(), writeable);

    assert.throws(tryToSetOverlapingChunk, new ChunkOverlap());
  });

  it("should throw an error when chunk is longher than address range", () => {
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const startIndex = tryAsPageIndex(5);
    const endIndex = createEndChunkIndex(6);
    const data = new Uint8Array([1, 2, 3, 4, 5, 6]);

    const tryToSetTooLongChunk = () => virtualPage.set(startIndex, endIndex, data, readable);

    assert.throws(tryToSetTooLongChunk, new ChunkTooLong());
  });

  it("should check if readable chunk is correctly created", () => {
    const startPageIndex = tryAsMemoryIndex(0);
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const startIndex = tryAsPageIndex(5);
    const endIndex = createEndChunkIndex(startIndex + bytes.length);
    const expectedPage = {
      chunks: [[startIndex, endIndex, bytes, readable]],
      start: startPageIndex,
    };

    virtualPage.set(startIndex, endIndex, bytes, readable);

    assert.deepEqual(virtualPage, expectedPage);
  });

  it("should check if writable chunk is correctly created (length === end - start)", () => {
    const startPageIndex = tryAsMemoryIndex(0);
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const startIndex = tryAsPageIndex(5);
    const endIndex = createEndChunkIndex(startIndex + bytes.length);
    const expectedPage = {
      chunks: [[startIndex, endIndex, bytes, writeable]],
      start: startPageIndex,
    };

    virtualPage.set(startIndex, endIndex, bytes, writeable);

    assert.deepEqual(virtualPage, expectedPage);
  });

  it("should check if writable chunk is correctly created (length < end - start)", () => {
    const startPageIndex = tryAsMemoryIndex(0);
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const extraBytes = new Uint8Array([0, 0, 0, 0, 0]);
    const startIndex = tryAsPageIndex(5);
    const endIndex = createEndChunkIndex(startIndex + bytes.length + extraBytes.length);
    const expectedPage = {
      chunks: [
        [startIndex, startIndex + bytes.length, bytes, writeable],
        [startIndex + bytes.length, endIndex, extraBytes, writeable],
      ],
      start: startPageIndex,
    };

    virtualPage.set(startIndex, endIndex, bytes, writeable);

    assert.deepEqual(virtualPage, expectedPage);
  });

  it("should return PageFault as the address is not part of any chunk", () => {
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const startIndex = tryAsPageIndex(5);
    const endIndex = createEndChunkIndex(startIndex + bytes.length);
    const indexToLoad = tryAsPageIndex(3);
    virtualPage.set(startIndex, endIndex, bytes, writeable);
    const result = new Uint8Array(4);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 4);

    assert.deepStrictEqual(loadResult, new PageFault(indexToLoad));
  });

  it("should not return PageFault when loading from the end of page", () => {
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const startIndex = tryAsPageIndex(PAGE_SIZE - bytes.length);
    const endIndex = createEndChunkIndex(PAGE_SIZE);
    const indexToLoad = tryAsPageIndex(PAGE_SIZE - 2);
    virtualPage.set(startIndex, endIndex, bytes, writeable);
    const result = new Uint8Array(2);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 2);

    assert.deepStrictEqual(loadResult, null);
    assert.deepStrictEqual(result, new Uint8Array([4, 5]));
  });

  it("should load 4 bytes from one chunk of readable memory", () => {
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const startIndex = tryAsPageIndex(5);
    const endIndex = createEndChunkIndex(startIndex + bytes.length);
    const indexToLoad = tryAsPageIndex(6);
    virtualPage.set(startIndex, endIndex, bytes, readable);
    const result = new Uint8Array(4);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 4);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, new Uint8Array([2, 3, 4, 5]));
  });

  it("should load 4 bytes from one chunk of readable memory (2 bytes from chunk and 2 bytes from 0s)", () => {
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const startIndex = tryAsPageIndex(5);
    const endIndex = createEndChunkIndex(15);
    const indexToLoad = tryAsPageIndex(8);
    virtualPage.set(startIndex, endIndex, bytes, readable);
    const result = new Uint8Array(4);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 4);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, new Uint8Array([4, 5, 0, 0]));
  });

  it("should load 4 bytes from one chunk of writeable memory (2 bytes from chunk and 2 bytes from 0s)", () => {
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const startIndex = tryAsPageIndex(5);
    const endIndex = createEndChunkIndex(15);
    const indexToLoad = tryAsPageIndex(8);
    virtualPage.set(startIndex, endIndex, bytes, writeable);
    const result = new Uint8Array(4);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 4);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, new Uint8Array([4, 5, 0, 0]));
  });

  it("should load 4 bytes from one chunk of writeable memory", () => {
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const startIndex = tryAsPageIndex(5);
    const endIndex = createEndChunkIndex(10);
    const indexToLoad = tryAsPageIndex(6);
    virtualPage.set(startIndex, endIndex, bytes, writeable);
    const result = new Uint8Array(4);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 4);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, new Uint8Array([2, 3, 4, 5]));
  });

  it("should load 1 byte from one chunk that have 1 byte length", () => {
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1]);
    const startIndex = tryAsPageIndex(5);
    const endIndex = createEndChunkIndex(6);
    const indexToLoad = tryAsPageIndex(5);
    virtualPage.set(startIndex, endIndex, bytes, writeable);
    const result = new Uint8Array(1);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 1);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, bytes);
  });

  it("should load 4 bytes from one chunk that have 4 bytes length", () => {
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const startIndex = tryAsPageIndex(5);
    const endIndex = createEndChunkIndex(10);
    const indexToLoad = tryAsPageIndex(5);
    virtualPage.set(startIndex, endIndex, bytes, writeable);
    const result = new Uint8Array(4);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 4);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, bytes);
  });

  it("should load 4 bytes from two chunks of memory", () => {
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const firstStartIndex = tryAsPageIndex(5);
    const firstEndIndex = createEndChunkIndex(10);
    const secondStartIndex = tryAsPageIndex(firstEndIndex);
    const secondEndIndex = createEndChunkIndex(15);
    const indexToLoad = tryAsPageIndex(8);
    virtualPage.set(secondStartIndex, secondEndIndex, bytes, readable);
    virtualPage.set(firstStartIndex, firstEndIndex, bytes, writeable);
    const result = new Uint8Array(4);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 4);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, new Uint8Array([4, 5, 1, 2]));
  });

  it("should return PageFault when load 4 bytes from two chunks of memory but there is a gap between them", () => {
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const firstStartIndex = tryAsPageIndex(5);
    const firstEndIndex = createEndChunkIndex(10);
    const secondStartIndex = tryAsPageIndex(firstEndIndex + 1);
    const secondEndIndex = createEndChunkIndex(secondStartIndex + 5);
    const indexToLoad = tryAsPageIndex(8);
    virtualPage.set(secondStartIndex, secondEndIndex, bytes, readable);
    virtualPage.set(firstStartIndex, firstEndIndex, bytes, writeable);
    const result = new Uint8Array(4);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 4);

    assert.deepStrictEqual(loadResult, new PageFault(firstEndIndex));
  });

  it("should return PageFaul when store 4 bytes into readable memory", () => {
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const startIndex = tryAsPageIndex(5);
    const endIndex = createEndChunkIndex(10);
    const indexToStore = tryAsPageIndex(6);
    virtualPage.set(startIndex, endIndex, bytes, readable);

    const storeResult = virtualPage.storeFrom(indexToStore, bytes);

    assert.deepStrictEqual(storeResult, new PageFault(indexToStore));
  });

  it("should return PageFault when store 4 bytes into inacessible memory", () => {
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const startIndex = tryAsPageIndex(5);
    const endIndex = createEndChunkIndex(10);
    const indexToStore = tryAsPageIndex(0);
    virtualPage.set(startIndex, endIndex, bytes, readable);

    const storeResult = virtualPage.storeFrom(indexToStore, bytes);

    assert.deepStrictEqual(storeResult, new PageFault(indexToStore));
  });

  it("should correctly store 4 bytes on one chunk", () => {
    const startPageIndex = tryAsMemoryIndex(0);
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const startIndex = tryAsPageIndex(5);
    const endIndex = createEndChunkIndex(10);
    const indexToStore = tryAsPageIndex(5);
    virtualPage.set(startIndex, endIndex, new Uint8Array(), writeable);
    const expectedPage = {
      chunks: [[startIndex, endIndex, new Uint8Array([...bytes, 0]), writeable]],
      start: startPageIndex,
    };

    const storeResult = virtualPage.storeFrom(indexToStore, bytes);

    assert.deepStrictEqual(storeResult, null);
    assert.deepEqual(virtualPage, expectedPage);
  });

  it("should correctly store 1 byte on one chunk that have 1 byte length", () => {
    const startPageIndex = tryAsMemoryIndex(0);
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1]);
    const startIndex = tryAsPageIndex(5);
    const endIndex = createEndChunkIndex(6);
    const indexToStore = tryAsPageIndex(5);
    virtualPage.set(startIndex, endIndex, new Uint8Array(), writeable);
    const expectedPage = {
      chunks: [[startIndex, endIndex, bytes, writeable]],
      start: startPageIndex,
    };

    const storeResult = virtualPage.storeFrom(indexToStore, bytes);

    assert.deepStrictEqual(storeResult, null);
    assert.deepEqual(virtualPage, expectedPage);
  });

  it("should correctly store 4 bytes on one chunk that have 4 bytes length", () => {
    const startPageIndex = tryAsMemoryIndex(0);
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const startIndex = tryAsPageIndex(5);
    const endIndex = createEndChunkIndex(9);
    const indexToStore = tryAsPageIndex(5);
    virtualPage.set(startIndex, endIndex, new Uint8Array(), writeable);
    const expectedPage = {
      chunks: [[startIndex, endIndex, bytes, writeable]],
      start: startPageIndex,
    };

    const storeResult = virtualPage.storeFrom(indexToStore, bytes);

    assert.deepStrictEqual(storeResult, null);
    assert.deepEqual(virtualPage, expectedPage);
  });

  it("should correctly store 4 bytes on two chunks", () => {
    const startPageIndex = tryAsMemoryIndex(0);
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytesToStore = new Uint8Array([1, 2, 3, 4]);
    const firstStartIndex = tryAsPageIndex(5);
    const firstEndIndex = createEndChunkIndex(10);
    const secondStartIndex = tryAsPageIndex(firstEndIndex);
    const secondEndIndex = createEndChunkIndex(15);
    const indexToStore = tryAsPageIndex(8);
    virtualPage.set(secondStartIndex, secondEndIndex, new Uint8Array(), writeable);
    virtualPage.set(firstStartIndex, firstEndIndex, new Uint8Array(), writeable);
    const expectedPage = {
      chunks: [
        [firstStartIndex, firstEndIndex, new Uint8Array([0, 0, 0, 1, 2]), writeable],
        [secondStartIndex, secondEndIndex, new Uint8Array([3, 4, 0, 0, 0]), writeable],
      ],
      start: startPageIndex,
    };

    const storeResult = virtualPage.storeFrom(indexToStore, bytesToStore);

    assert.deepStrictEqual(storeResult, null);
    assert.deepEqual(virtualPage, expectedPage);
  });

  it("should return PageFault when storing 4 bytes on 2 chunks but there is a gap between them", () => {
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytesToStore = new Uint8Array([1, 2, 3, 4]);
    const firstStartIndex = tryAsPageIndex(5);
    const firstEndIndex = createEndChunkIndex(10);
    const secondStartIndex = tryAsPageIndex(11);
    const secondEndIndex = createEndChunkIndex(15);
    const indexToStore = tryAsPageIndex(8);
    virtualPage.set(secondStartIndex, secondEndIndex, new Uint8Array(), writeable);
    virtualPage.set(firstStartIndex, firstEndIndex, new Uint8Array(), writeable);

    const storeResult = virtualPage.storeFrom(indexToStore, bytesToStore);

    assert.deepStrictEqual(storeResult, new PageFault(firstEndIndex));
  });

  it("should not return PageFault when storing at the end of page", () => {
    const startPageIndex = tryAsMemoryIndex(0);
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytesToStore = new Uint8Array([1, 2]);
    const startIndex = tryAsPageIndex(PAGE_SIZE - 5);
    const endIndex = createEndChunkIndex(PAGE_SIZE);
    const indexToStore = tryAsPageIndex(PAGE_SIZE - 2);
    virtualPage.set(startIndex, endIndex, new Uint8Array(), writeable);
    const expectedPage = {
      chunks: [[startIndex, endIndex, new Uint8Array([0, 0, 0, 1, 2]), writeable]],
      start: startPageIndex,
    };

    const storeResult = virtualPage.storeFrom(indexToStore, bytesToStore);

    assert.deepStrictEqual(storeResult, null);
    assert.deepEqual(virtualPage, expectedPage);
  });

  it("should return true if given range is writeable", () => {
    const pageIdx = tryAsPageIndex;
    const pageNumber = tryAsPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const startIndex = tryAsPageIndex(PAGE_SIZE - 5);
    const endIndex = createEndChunkIndex(PAGE_SIZE);
    virtualPage.set(startIndex, endIndex, new Uint8Array(), writeable);

    // then
    assert.deepStrictEqual(virtualPage.isWriteable(pageIdx(0), startIndex), false);
    assert.deepStrictEqual(virtualPage.isWriteable(pageIdx(PAGE_SIZE - 6), 1), false);
    assert.deepStrictEqual(virtualPage.isWriteable(pageIdx(PAGE_SIZE - 6), 6), false);
    assert.deepStrictEqual(virtualPage.isWriteable(startIndex, 5), true);
    assert.deepStrictEqual(virtualPage.isWriteable(startIndex, 1), true);
    assert.deepStrictEqual(virtualPage.isWriteable(pageIdx(startIndex + 1), 1), true);
    assert.deepStrictEqual(virtualPage.isWriteable(pageIdx(startIndex + 1), 4), true);
  });
});
