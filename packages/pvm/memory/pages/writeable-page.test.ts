import assert from "node:assert";
import { describe, it } from "node:test";

import { AddressIsNotBeginningOfPage } from "../errors";
import { MIN_ALLOCATION_LENGTH, PAGE_SIZE } from "../memory-consts";
import { createMemoryIndex } from "../memory-index";
import { WriteablePage } from "./writeable-page";

describe("WriteablePage", () => {
  it("should throw an error when start address is not the beginning of a page", () => {
    const initialMemory = new Uint8Array();
    const startIndex = createMemoryIndex(1);

    const tryToCreateReadablePage = () => new WriteablePage(startIndex, initialMemory);

    assert.throws(tryToCreateReadablePage, new AddressIsNotBeginningOfPage(startIndex));
  });

  it("should load 4 byts from memory", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const initialMemory = new Uint8Array([0, ...bytes]);
    const startIndex = createMemoryIndex(0);
    const readablePage = new WriteablePage(startIndex, initialMemory);
    const lengthToLoad = 4;
    const result = new Uint8Array(lengthToLoad);
    const expectedResult = bytes;
    const loadIndex = createMemoryIndex(startIndex + 1);

    const loadResult = readablePage.loadInto(result, loadIndex, lengthToLoad);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, expectedResult);
  });

  it("should fill missing bytes with zeros", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const initialMemory = new Uint8Array([0, ...bytes]);
    const startIndex = createMemoryIndex(0);
    const readablePage = new WriteablePage(startIndex, initialMemory);
    const lengthToLoad = 4;
    const result = new Uint8Array(lengthToLoad);
    const expectedResult = new Uint8Array([3, 4, 0, 0]);
    const loadIndex = createMemoryIndex(startIndex + 3);

    const loadResult = readablePage.loadInto(result, loadIndex, lengthToLoad);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, expectedResult);
  });

  it("should store 4 bytes", () => {
    const startIndex = createMemoryIndex(0);
    const bytesToStore = new Uint8Array([1, 2, 3, 4]);
    const addressToStore = createMemoryIndex(1);
    const writeablePage = new WriteablePage(startIndex);
    const expectedBuffer = new ArrayBuffer(MIN_ALLOCATION_LENGTH);
    const expectedView = new Uint8Array(expectedBuffer);
    expectedView.set(bytesToStore, addressToStore);
    const expectedObject = {
      start: startIndex,
      end: startIndex + PAGE_SIZE,
      buffer: expectedBuffer,
      view: expectedView,
    };

    const storeResult = writeablePage.storeFrom(addressToStore, bytesToStore);

    assert.strictEqual(storeResult, null);
    assert.deepEqual(writeablePage, expectedObject);
  });

  it("should resize buffer and store 4 bytes on newly allocated space", () => {
    const startIndex = createMemoryIndex(0);
    const bytesToStore = new Uint8Array([1, 2, 3, 4]);
    const addressToStore = createMemoryIndex(MIN_ALLOCATION_LENGTH);
    const writeablePage = new WriteablePage(startIndex);
    const expectedBuffer = new ArrayBuffer(2 * MIN_ALLOCATION_LENGTH);
    const expectedView = new Uint8Array(expectedBuffer);
    expectedView.set(bytesToStore, MIN_ALLOCATION_LENGTH);
    const expectedObject = {
      start: startIndex,
      end: startIndex + PAGE_SIZE,
      buffer: expectedBuffer,
      view: expectedView,
    };

    const storeResult = writeablePage.storeFrom(addressToStore, bytesToStore);

    assert.strictEqual(storeResult, null);
    assert.deepEqual(writeablePage, expectedObject);
  });
});
