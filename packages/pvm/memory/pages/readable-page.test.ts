import assert from "node:assert";
import { describe, it } from "node:test";
import { AddressIsNotBeginningOfPage, PageFault } from "../errors";
import { createMemoryIndex } from "../memory-index";
import { ReadablePage } from "./readable-page";

describe("ReadablePage", () => {
  it("should throw an error when start address is not the beginning of a page", () => {
    const initialMemory = new Uint8Array();
    const startIndex = createMemoryIndex(1);

    const tryToCreateReadablePage = () => new ReadablePage(startIndex, initialMemory);

    assert.throws(tryToCreateReadablePage, new AddressIsNotBeginningOfPage(startIndex));
  });

  it("should load 4 byts from memory", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const initialMemory = new Uint8Array([0, ...bytes]);
    const startIndex = createMemoryIndex(0);
    const readablePage = new ReadablePage(startIndex, initialMemory);
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
    const readablePage = new ReadablePage(startIndex, initialMemory);
    const lengthToLoad = 4;
    const result = new Uint8Array(lengthToLoad);
    const expectedResult = new Uint8Array([3, 4, 0, 0]);
    const loadIndex = createMemoryIndex(startIndex + 3);

    const loadResult = readablePage.loadInto(result, loadIndex, lengthToLoad);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, expectedResult);
  });

  it("should throw a page fault error when store is used", () => {
    const initialMemory = new Uint8Array();
    const startIndex = createMemoryIndex(0);
    const readablePage = new ReadablePage(startIndex, initialMemory);

    const storeResult = readablePage.storeFrom(startIndex, new Uint8Array());

    assert.deepStrictEqual(storeResult, new PageFault(startIndex));
  });
});
