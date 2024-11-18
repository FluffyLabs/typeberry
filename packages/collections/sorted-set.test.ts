import assert from "node:assert";
import { describe, it } from "node:test";

import { Ordering } from "./sorted-array";
import { SortedSet } from "./sorted-set";

describe("SortedSet", () => {
  const cmp = (self: number, other: number) => {
    const r = self - other;
    if (r > 0) {
      return Ordering.Greater;
    }

    if (r < 0) {
      return Ordering.Less;
    }

    return Ordering.Equal;
  };

  describe("fromArray", () => {
    it("should create SortedSet from not sorted array", () => {
      const data = [1, 3, 2];

      const result = SortedSet.fromArray(cmp, data);

      assert.deepStrictEqual(result.slice(), [1, 2, 3]);
    });
  });

  describe("fromSortedArray", () => {
    it("should throw when using fromSortedArray and array is not sorted", () => {
      const data = [1, 3, 2];

      const tryToCreate = () => SortedSet.fromSortedArray(cmp, data);

      assert.throws(tryToCreate, new Error(`Expected sorted array without duplicates, got: ${data}`));
    });

    it("should not throw when using fromSortedArray and array is sorted", () => {
      const data = [1, 2, 3];

      const result = SortedSet.fromSortedArray(cmp, data);

      assert.deepStrictEqual(result.slice(), data);
    });

    it("should throw when using fromSortedArray and array is sorted and contains duplicates", () => {
      const data = [1, 2, 2, 3];

      const tryToCreate = () => SortedSet.fromSortedArray(cmp, data);

      assert.throws(tryToCreate, new Error(`Expected sorted array without duplicates, got: ${data}`));
    });
  });

  describe("insert", () => {
    it("should insert a bunch of items and keep the in order", () => {
      const data = SortedSet.fromArray(cmp, [5, 2, 3]);

      data.insert(1);
      data.insert(10);
      data.insert(-50);

      assert.deepStrictEqual(data.slice(), [-50, 1, 2, 3, 5, 10]);
      assert.deepStrictEqual(data.length, 6);
    });

    it("should not insert duplicated items", () => {
      const data = SortedSet.fromArray(cmp, [5, 2, 3]);

      data.insert(5);
      data.insert(5);
      data.insert(3);

      assert.deepStrictEqual(data.slice(), [2, 3, 5]);
      assert.deepStrictEqual(data.length, 3);
    });
  });
});
