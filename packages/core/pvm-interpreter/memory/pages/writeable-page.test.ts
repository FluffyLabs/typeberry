import assert from "node:assert";
import { describe, it } from "node:test";

import { OK, Result } from "@typeberry/utils";
import { MIN_ALLOCATION_LENGTH } from "../memory-consts.js";
import { tryAsMemoryIndex } from "../memory-index.js";
import { tryAsPageIndex, tryAsPageNumber } from "./page-utils.js";
import { WriteablePage } from "./writeable-page.js";

describe("WriteablePage", () => {
  it("should load 4 bytes from memory", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const initialMemory = new Uint8Array([0, ...bytes]);
    const startIndex = tryAsMemoryIndex(0);
    const pageNumber = tryAsPageNumber(0);
    const readablePage = new WriteablePage(pageNumber, initialMemory);
    const lengthToLoad = 4;
    const result = new Uint8Array(lengthToLoad);
    const expectedResult = bytes;
    const loadIndex = tryAsPageIndex(startIndex + 1);

    const loadResult = readablePage.loadInto(result, loadIndex, lengthToLoad);

    assert.deepStrictEqual(loadResult, Result.ok(OK));
    assert.deepStrictEqual(result, expectedResult);
  });

  it("should fill missing bytes with zeros", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const initialMemory = new Uint8Array([0, ...bytes]);
    const startIndex = tryAsMemoryIndex(0);
    const pageNumber = tryAsPageNumber(0);
    const readablePage = new WriteablePage(pageNumber, initialMemory);
    const lengthToLoad = 4;
    const result = new Uint8Array(lengthToLoad);
    const expectedResult = new Uint8Array([3, 4, 0, 0]);
    const loadIndex = tryAsPageIndex(startIndex + 3);

    const loadResult = readablePage.loadInto(result, loadIndex, lengthToLoad);

    assert.deepStrictEqual(loadResult, Result.ok(OK));
    assert.deepStrictEqual(result, expectedResult);
  });

  it("should store 4 bytes", () => {
    const startIndex = tryAsMemoryIndex(0);
    const pageNumber = tryAsPageNumber(0);
    const bytesToStore = new Uint8Array([1, 2, 3, 4]);
    const indexToStore = tryAsPageIndex(1);
    const writeablePage = new WriteablePage(pageNumber);
    const expectedBuffer = new ArrayBuffer(MIN_ALLOCATION_LENGTH);
    const expectedView = new Uint8Array(expectedBuffer);
    expectedView.set(bytesToStore, indexToStore);
    const expectedObject = {
      start: startIndex,
      buffer: expectedBuffer,
      view: expectedView,
    };

    const storeResult = writeablePage.storeFrom(indexToStore, bytesToStore);

    assert.deepStrictEqual(storeResult, Result.ok(OK));
    assert.deepEqual(writeablePage, expectedObject);
  });

  it("should resize buffer and store 4 bytes on newly allocated space", () => {
    const startIndex = tryAsMemoryIndex(0);
    const pageNumber = tryAsPageNumber(0);
    const bytesToStore = new Uint8Array([1, 2, 3, 4]);
    const indexToStore = tryAsPageIndex(MIN_ALLOCATION_LENGTH);
    const writeablePage = new WriteablePage(pageNumber);
    const expectedBuffer = new ArrayBuffer(MIN_ALLOCATION_LENGTH + bytesToStore.length);
    const expectedView = new Uint8Array(expectedBuffer);
    expectedView.set(bytesToStore, MIN_ALLOCATION_LENGTH);
    const expectedObject = {
      start: startIndex,
      buffer: expectedBuffer,
      view: expectedView,
    };

    const storeResult = writeablePage.storeFrom(indexToStore, bytesToStore);

    assert.deepStrictEqual(storeResult, Result.ok(OK));
    assert.deepEqual(writeablePage, expectedObject);
  });
});
