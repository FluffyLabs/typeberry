import assert from "node:assert";
import { describe, it } from "node:test";
import { ChunkOverlap, ChunkTooLong, PageFault } from "../errors";
import { PAGE_SIZE } from "../memory-consts";
import { createMemoryIndex } from "../memory-index";
import { createPageIndex, createPageNumber } from "./page-utils";
import { VirtualPage, readable, writeable } from "./virtual-page";

describe("VirtualPage", () => {
  it("should throw an error when chunks overlap each other", () => {
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);

    virtualPage.set(createMemoryIndex(5), createMemoryIndex(10), new Uint8Array(), readable);
    const tryToSetOverlapingChunk = () =>
      virtualPage.set(createMemoryIndex(8), createMemoryIndex(12), new Uint8Array(), writeable);

    assert.throws(tryToSetOverlapingChunk, new ChunkOverlap());
  });

  it("should throw an error when chunk is longher than address range", () => {
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const startIndex = createMemoryIndex(5);
    const endIndex = createMemoryIndex(6);
    const data = new Uint8Array([1, 2, 3, 4, 5, 6]);

    const tryToSetTooLongChunk = () => virtualPage.set(startIndex, endIndex, data, readable);

    assert.throws(tryToSetTooLongChunk, new ChunkTooLong());
  });

  it("should check if readable chunk is correctly created", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const startIndex = createMemoryIndex(5);
    const endIndex = createMemoryIndex(startIndex + bytes.length);
    const expectedPage = {
      chunks: [[startIndex, endIndex, bytes, readable]],
      end: startPageIndex + PAGE_SIZE,
      start: startPageIndex,
    };

    virtualPage.set(startIndex, endIndex, bytes, readable);

    assert.deepEqual(virtualPage, expectedPage);
  });

  it("should check if writable chunk is correctly created (length === end - start)", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const startIndex = createMemoryIndex(5);
    const endIndex = createMemoryIndex(startIndex + bytes.length);
    const expectedPage = {
      chunks: [[startIndex, endIndex, bytes, writeable]],
      end: startPageIndex + PAGE_SIZE,
      start: startPageIndex,
    };

    virtualPage.set(startIndex, endIndex, bytes, writeable);

    assert.deepEqual(virtualPage, expectedPage);
  });

  it("should check if writable chunk is correctly created (length < end - start)", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const extraBytes = new Uint8Array([0, 0, 0, 0, 0]);
    const startIndex = createMemoryIndex(5);
    const endIndex = createMemoryIndex(startIndex + bytes.length + extraBytes.length);
    const expectedPage = {
      chunks: [
        [startIndex, startIndex + bytes.length, bytes, writeable],
        [startIndex + bytes.length, endIndex, extraBytes, writeable],
      ],
      end: startPageIndex + PAGE_SIZE,
      start: startPageIndex,
    };

    virtualPage.set(startIndex, endIndex, bytes, writeable);

    assert.deepEqual(virtualPage, expectedPage);
  });

  it("should return PageFault as the address is not part of any chunk", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const startIndex = createMemoryIndex(5);
    const endIndex = createMemoryIndex(startIndex + bytes.length);
    const indexToLoad = createPageIndex(3);
    virtualPage.set(startIndex, endIndex, bytes, writeable);
    const result = new Uint8Array(4);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 4);

    assert.deepStrictEqual(loadResult, new PageFault(indexToLoad));
  });

  it("should not return PageFault when loading from the end of page", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const startIndex = createMemoryIndex(PAGE_SIZE - bytes.length);
    const endIndex = createMemoryIndex(PAGE_SIZE);
    const indexToLoad = createPageIndex(PAGE_SIZE - 2);
    virtualPage.set(startIndex, endIndex, bytes, writeable);
    const result = new Uint8Array(2);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 2);

    assert.deepStrictEqual(loadResult, null);
    assert.deepStrictEqual(result, new Uint8Array([4, 5]));
  });

  it("should load 4 bytes from one chunk of readable memory", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const startIndex = createMemoryIndex(5);
    const endIndex = createMemoryIndex(startIndex + bytes.length);
    const indexToLoad = createPageIndex(6);
    virtualPage.set(startIndex, endIndex, bytes, readable);
    const result = new Uint8Array(4);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 4);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, new Uint8Array([2, 3, 4, 5]));
  });

  it("should load 4 bytes from one chunk of readable memory (2 bytes from chunk and 2 bytes from 0s)", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const startIndex = createMemoryIndex(5);
    const endIndex = createMemoryIndex(15);
    const indexToLoad = createPageIndex(8);
    virtualPage.set(startIndex, endIndex, bytes, readable);
    const result = new Uint8Array(4);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 4);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, new Uint8Array([4, 5, 0, 0]));
  });

  it("should load 4 bytes from one chunk of writeable memory (2 bytes from chunk and 2 bytes from 0s)", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const startIndex = createMemoryIndex(5);
    const endIndex = createMemoryIndex(15);
    const indexToLoad = createPageIndex(8);
    virtualPage.set(startIndex, endIndex, bytes, writeable);
    const result = new Uint8Array(4);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 4);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, new Uint8Array([4, 5, 0, 0]));
  });

  it("should load 4 bytes from one chunk of writeable memory", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const startIndex = createMemoryIndex(5);
    const endIndex = createMemoryIndex(10);
    const indexToLoad = createPageIndex(6);
    virtualPage.set(startIndex, endIndex, bytes, writeable);
    const result = new Uint8Array(4);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 4);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, new Uint8Array([2, 3, 4, 5]));
  });

  it("should load 1 byte from one chunk that have 1 byte length", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1]);
    const startIndex = createMemoryIndex(5);
    const endIndex = createMemoryIndex(6);
    const indexToLoad = createPageIndex(5);
    virtualPage.set(startIndex, endIndex, bytes, writeable);
    const result = new Uint8Array(1);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 1);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, bytes);
  });

  it("should load 4 bytes from one chunk that have 4 bytes length", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const startIndex = createMemoryIndex(5);
    const endIndex = createMemoryIndex(10);
    const indexToLoad = createPageIndex(5);
    virtualPage.set(startIndex, endIndex, bytes, writeable);
    const result = new Uint8Array(4);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 4);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, bytes);
  });

  it("should load 4 bytes from two chunks of memory", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const firstStartIndex = createMemoryIndex(5);
    const firstEndIndex = createMemoryIndex(10);
    const secondStartIndex = firstEndIndex;
    const secondEndIndex = createMemoryIndex(15);
    const indexToLoad = createPageIndex(8);
    virtualPage.set(secondStartIndex, secondEndIndex, bytes, readable);
    virtualPage.set(firstStartIndex, firstEndIndex, bytes, writeable);
    const result = new Uint8Array(4);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 4);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, new Uint8Array([4, 5, 1, 2]));
  });

  it("should return PageFault when load 4 bytes from two chunks of memory but there is a gap between them", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const firstStartIndex = createMemoryIndex(5);
    const firstEndIndex = createMemoryIndex(10);
    const secondStartIndex = createMemoryIndex(firstEndIndex + 1);
    const secondEndIndex = createMemoryIndex(secondStartIndex + 5);
    const indexToLoad = createPageIndex(8);
    virtualPage.set(secondStartIndex, secondEndIndex, bytes, readable);
    virtualPage.set(firstStartIndex, firstEndIndex, bytes, writeable);
    const result = new Uint8Array(4);

    const loadResult = virtualPage.loadInto(result, indexToLoad, 4);

    assert.deepStrictEqual(loadResult, new PageFault(firstEndIndex));
  });

  it("should return PageFaul when store 4 bytes into readable memory", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const startIndex = createMemoryIndex(5);
    const endIndex = createMemoryIndex(10);
    const indexToStore = createPageIndex(6);
    virtualPage.set(startIndex, endIndex, bytes, readable);

    const storeResult = virtualPage.storeFrom(indexToStore, bytes);

    assert.deepStrictEqual(storeResult, new PageFault(indexToStore));
  });

  it("should return PageFault when store 4 bytes into inacessible memory", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const startIndex = createMemoryIndex(5);
    const endIndex = createMemoryIndex(10);
    const indexToStore = createPageIndex(0);
    virtualPage.set(startIndex, endIndex, bytes, readable);

    const storeResult = virtualPage.storeFrom(indexToStore, bytes);

    assert.deepStrictEqual(storeResult, new PageFault(indexToStore));
  });

  it("should correctly store 4 bytes on one chunk", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const startIndex = createMemoryIndex(5);
    const endIndex = createMemoryIndex(10);
    const indexToStore = createPageIndex(5);
    virtualPage.set(startIndex, endIndex, new Uint8Array(), writeable);
    const expectedPage = {
      chunks: [[startIndex, endIndex, new Uint8Array([...bytes, 0]), writeable]],
      end: startPageIndex + PAGE_SIZE,
      start: startPageIndex,
    };

    const storeResult = virtualPage.storeFrom(indexToStore, bytes);

    assert.deepStrictEqual(storeResult, null);
    assert.deepEqual(virtualPage, expectedPage);
  });

  it("should correctly store 1 byte on one chunk that have 1 byte length", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1]);
    const startIndex = createMemoryIndex(5);
    const endIndex = createMemoryIndex(6);
    const indexToStore = createPageIndex(5);
    virtualPage.set(startIndex, endIndex, new Uint8Array(), writeable);
    const expectedPage = {
      chunks: [[startIndex, endIndex, bytes, writeable]],
      end: startPageIndex + PAGE_SIZE,
      start: startPageIndex,
    };

    const storeResult = virtualPage.storeFrom(indexToStore, bytes);

    assert.deepStrictEqual(storeResult, null);
    assert.deepEqual(virtualPage, expectedPage);
  });

  it("should correctly store 4 bytes on one chunk that have 4 bytes length", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const startIndex = createMemoryIndex(5);
    const endIndex = createMemoryIndex(9);
    const indexToStore = createPageIndex(5);
    virtualPage.set(startIndex, endIndex, new Uint8Array(), writeable);
    const expectedPage = {
      chunks: [[startIndex, endIndex, bytes, writeable]],
      end: startPageIndex + PAGE_SIZE,
      start: startPageIndex,
    };

    const storeResult = virtualPage.storeFrom(indexToStore, bytes);

    assert.deepStrictEqual(storeResult, null);
    assert.deepEqual(virtualPage, expectedPage);
  });

  it("should correctly store 4 bytes on two chunks", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytesToStore = new Uint8Array([1, 2, 3, 4]);
    const firstStartIndex = createMemoryIndex(5);
    const firstEndIndex = createMemoryIndex(10);
    const secondStartIndex = createMemoryIndex(firstEndIndex);
    const secondEndIndex = createMemoryIndex(15);
    const indexToStore = createPageIndex(8);
    virtualPage.set(secondStartIndex, secondEndIndex, new Uint8Array(), writeable);
    virtualPage.set(firstStartIndex, firstEndIndex, new Uint8Array(), writeable);
    const expectedPage = {
      chunks: [
        [firstStartIndex, firstEndIndex, new Uint8Array([0, 0, 0, 1, 2]), writeable],
        [secondStartIndex, secondEndIndex, new Uint8Array([3, 4, 0, 0, 0]), writeable],
      ],
      end: startPageIndex + PAGE_SIZE,
      start: startPageIndex,
    };

    const storeResult = virtualPage.storeFrom(indexToStore, bytesToStore);

    assert.deepStrictEqual(storeResult, null);
    assert.deepEqual(virtualPage, expectedPage);
  });

  it("should return PageFault when storing 4 bytes on 2 chunks but there is a gap between them", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytesToStore = new Uint8Array([1, 2, 3, 4]);
    const firstStartIndex = createMemoryIndex(5);
    const firstEndIndex = createMemoryIndex(10);
    const secondStartIndex = createMemoryIndex(11);
    const secondEndIndex = createMemoryIndex(15);
    const indexToStore = createPageIndex(8);
    virtualPage.set(secondStartIndex, secondEndIndex, new Uint8Array(), writeable);
    virtualPage.set(firstStartIndex, firstEndIndex, new Uint8Array(), writeable);

    const storeResult = virtualPage.storeFrom(indexToStore, bytesToStore);

    assert.deepStrictEqual(storeResult, new PageFault(firstEndIndex));
  });

  it("should not return PageFault when storing at the end of page", () => {
    const startPageIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const virtualPage = new VirtualPage(pageNumber);
    const bytesToStore = new Uint8Array([1, 2]);
    const startIndex = createMemoryIndex(PAGE_SIZE - 5);
    const endIndex = createMemoryIndex(PAGE_SIZE);
    const indexToStore = createPageIndex(PAGE_SIZE - 2);
    virtualPage.set(startIndex, endIndex, new Uint8Array(), writeable);
    const expectedPage = {
      chunks: [[startIndex, endIndex, new Uint8Array([0, 0, 0, 1, 2]), writeable]],
      end: startPageIndex + PAGE_SIZE,
      start: startPageIndex,
    };

    const storeResult = virtualPage.storeFrom(indexToStore, bytesToStore);

    assert.deepStrictEqual(storeResult, null);
    assert.deepEqual(virtualPage, expectedPage);
  });
});
