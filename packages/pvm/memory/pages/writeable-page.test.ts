import assert from "node:assert";
import { describe, it } from "node:test";

import { MIN_ALLOCATION_LENGTH, PAGE_SIZE } from "../memory-consts";
import { createMemoryIndex } from "../memory-index";
import { createPageIndex, createPageNumber } from "./page-utils";
import { WriteablePage } from "./writeable-page";

describe("WriteablePage", () => {
  it("should load 4 bytes from memory", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const initialMemory = new Uint8Array([0, ...bytes]);
    const startIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const readablePage = new WriteablePage(pageNumber, initialMemory);
    const lengthToLoad = 4;
    const result = new Uint8Array(lengthToLoad);
    const expectedResult = bytes;
    const loadIndex = createPageIndex(startIndex + 1);

    const loadResult = readablePage.loadInto(result, loadIndex, lengthToLoad);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, expectedResult);
  });

  it("should fill missing bytes with zeros", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const initialMemory = new Uint8Array([0, ...bytes]);
    const startIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const readablePage = new WriteablePage(pageNumber, initialMemory);
    const lengthToLoad = 4;
    const result = new Uint8Array(lengthToLoad);
    const expectedResult = new Uint8Array([3, 4, 0, 0]);
    const loadIndex = createPageIndex(startIndex + 3);

    const loadResult = readablePage.loadInto(result, loadIndex, lengthToLoad);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, expectedResult);
  });

  it("should store 4 bytes", () => {
    const startIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const bytesToStore = new Uint8Array([1, 2, 3, 4]);
    const indexToStore = createPageIndex(1);
    const writeablePage = new WriteablePage(pageNumber);
    const expectedBuffer = new ArrayBuffer(MIN_ALLOCATION_LENGTH);
    const expectedView = new Uint8Array(expectedBuffer);
    expectedView.set(bytesToStore, indexToStore);
    const expectedObject = {
      start: startIndex,
      end: startIndex + PAGE_SIZE,
      buffer: expectedBuffer,
      view: expectedView,
    };

    const storeResult = writeablePage.storeFrom(indexToStore, bytesToStore);

    assert.strictEqual(storeResult, null);
    assert.deepEqual(writeablePage, expectedObject);
  });

  it("should resize buffer and store 4 bytes on newly allocated space", () => {
    const startIndex = createMemoryIndex(0);
    const pageNumber = createPageNumber(0);
    const bytesToStore = new Uint8Array([1, 2, 3, 4]);
    const indexToStore = createPageIndex(MIN_ALLOCATION_LENGTH);
    const writeablePage = new WriteablePage(pageNumber);
    const expectedBuffer = new ArrayBuffer(2 * MIN_ALLOCATION_LENGTH);
    const expectedView = new Uint8Array(expectedBuffer);
    expectedView.set(bytesToStore, MIN_ALLOCATION_LENGTH);
    const expectedObject = {
      start: startIndex,
      end: startIndex + PAGE_SIZE,
      buffer: expectedBuffer,
      view: expectedView,
    };

    const storeResult = writeablePage.storeFrom(indexToStore, bytesToStore);

    assert.strictEqual(storeResult, null);
    assert.deepEqual(writeablePage, expectedObject);
  });
});
