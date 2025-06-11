import assert from "node:assert";
import { describe, it } from "node:test";
import { LAST_PAGE_NUMBER } from "../memory-consts.js";
import { getNextPageNumber, tryAsPageNumber } from "./page-utils.js";

describe("page-utils / getNextPageNumber", () => {
  it("should increment the page number", () => {
    const pageNumber = tryAsPageNumber(5);

    const nextPageNumber = getNextPageNumber(pageNumber);

    assert.strictEqual(nextPageNumber, pageNumber + 1);
  });

  it("should return 0 for the last page number", () => {
    const pageNumber = tryAsPageNumber(LAST_PAGE_NUMBER);

    const nextPageNumber = getNextPageNumber(pageNumber);

    assert.strictEqual(nextPageNumber, 0);
  });
});
