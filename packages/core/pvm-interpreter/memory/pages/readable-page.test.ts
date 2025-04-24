import assert from "node:assert";
import { describe, it } from "node:test";
import { PageFault } from "../errors";
import { tryAsMemoryIndex } from "../memory-index";
import { tryAsPageIndex, tryAsPageNumber } from "./page-utils";
import { ReadablePage } from "./readable-page";

describe("ReadablePage", () => {
  it("should load 4 byts from memory", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const initialMemory = new Uint8Array([0, ...bytes]);
    const startIndex = tryAsMemoryIndex(0);
    const pageNumber = tryAsPageNumber(0);
    const readablePage = new ReadablePage(pageNumber, initialMemory);
    const lengthToLoad = 4;
    const result = new Uint8Array(lengthToLoad);
    const expectedResult = bytes;
    const loadIndex = tryAsPageIndex(startIndex + 1);

    const loadResult = readablePage.loadInto(result, loadIndex, lengthToLoad);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, expectedResult);
  });

  it("should fill missing bytes with zeros", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const initialMemory = new Uint8Array([0, ...bytes]);
    const startIndex = tryAsMemoryIndex(0);
    const pageNumber = tryAsPageNumber(0);
    const readablePage = new ReadablePage(pageNumber, initialMemory);
    const lengthToLoad = 4;
    const result = new Uint8Array(lengthToLoad);
    const expectedResult = new Uint8Array([3, 4, 0, 0]);
    const loadIndex = tryAsPageIndex(startIndex + 3);

    const loadResult = readablePage.loadInto(result, loadIndex, lengthToLoad);

    assert.strictEqual(loadResult, null);
    assert.deepStrictEqual(result, expectedResult);
  });

  it("should throw a page fault error when store is used", () => {
    const initialMemory = new Uint8Array();
    const storeIndex = tryAsPageIndex(0);
    const pageNumber = tryAsPageNumber(0);
    const readablePage = new ReadablePage(pageNumber, initialMemory);

    const storeResult = readablePage.storeFrom(storeIndex, new Uint8Array());

    assert.deepStrictEqual(storeResult, PageFault.fromPageNumber(0, true));
  });
});
