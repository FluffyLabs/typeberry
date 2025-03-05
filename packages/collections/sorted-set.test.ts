import assert from "node:assert";
import { describe, it } from "node:test";

import { EQUAL, GREATER, LESS } from "@typeberry/ordering";
import { SortedSet } from "./sorted-set";

describe("SortedSet", () => {
  const cmp = (self: number, other: number) => {
    const r = self - other;
    if (r > 0) {
      return GREATER;
    }

    if (r < 0) {
      return LESS;
    }

    return EQUAL;
  };

  describe("fromArray", () => {
    it("should create SortedSet from not sorted array", () => {
      const data = [1, 3, 2];

      const result = SortedSet.fromArray(cmp, data);

      assert.deepStrictEqual(result.slice(), [1, 2, 3]);
    });

    it("should throw when using fromArray and array contains duplicates", () => {
      const data = [1, 3, 3, 2];

      const tryToCreate = () => SortedSet.fromArray(cmp, data);

      assert.throws(tryToCreate, new Error(`Expected array without duplicates, got: ${data}`));
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

  describe("fromTwoSortedCollections", () => {
    it("should merge two sorted sets without duplicates", () => {
      const arr1 = [1, 2, 3];
      const arr2 = [4, 5, 6];
      const toMerge1 = SortedSet.fromArray(cmp, arr1);
      const toMerge2 = SortedSet.fromArray(cmp, arr2);

      const result = SortedSet.fromTwoSortedCollections(toMerge1, toMerge2);

      assert.deepStrictEqual(result.slice(), [...arr1, ...arr2]);
    });

    it("should merge two sorted sets with duplicates", () => {
      const arr = [1, 2, 3];
      const toMerge1 = SortedSet.fromArray(cmp, arr);
      const toMerge2 = SortedSet.fromArray(cmp, arr);

      const result = SortedSet.fromTwoSortedCollections(toMerge1, toMerge2);

      assert.deepStrictEqual(result.slice(), arr);
    });

    it("should merge two empty sets", () => {
      const arr: number[] = [];
      const toMerge1 = SortedSet.fromArray(cmp, arr);
      const toMerge2 = SortedSet.fromArray(cmp, arr);

      const result = SortedSet.fromTwoSortedCollections(toMerge1, toMerge2);

      assert.deepStrictEqual(result.slice(), arr);
    });

    it("should merge two sets with one duplicated item", () => {
      const arr: number[] = [0];
      const toMerge1 = SortedSet.fromArray(cmp, arr);
      const toMerge2 = SortedSet.fromArray(cmp, arr);

      const result = SortedSet.fromTwoSortedCollections(toMerge1, toMerge2);

      assert.deepStrictEqual(result.slice(), arr);
    });
  });
});
