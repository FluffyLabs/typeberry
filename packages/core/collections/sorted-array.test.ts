import assert from "node:assert";
import { describe, it } from "node:test";
import { Ordering } from "@typeberry/ordering";
import { SortedArray } from "./sorted-array";

describe("SortedArray", { timeout: 10 }, () => {
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

  it("should insert a bunch of items and keep the in order", () => {
    const data = SortedArray.fromArray(cmp, [5, 2, 3]);

    data.insert(1);
    data.insert(10);
    data.insert(-50);

    assert.deepStrictEqual(data.slice().toString(), [-50, 1, 2, 3, 5, 10].toString());
    assert.deepStrictEqual(data.length, 6);
  });

  it("should work with duplicates", () => {
    const data = SortedArray.fromArray(cmp);
    data.insert(1);
    data.insert(2);
    data.insert(3);
    data.insert(2);
    data.insert(3);
    data.insert(1);
    data.insert(1);

    assert.deepStrictEqual(data.slice().toString(), [1, 1, 1, 2, 2, 3, 3].toString());
  });

  it("should return true if element is present", () => {
    const data = SortedArray.fromArray(cmp);
    data.insert(1);
    data.insert(2);
    data.insert(3);
    data.insert(2);

    assert.ok(data.has(1));
    assert.ok(data.has(2));
    assert.ok(data.has(3));
    assert.ok(!data.has(4));
    assert.ok(!data.has(-150));
  });

  it("should remove one element", () => {
    const data = SortedArray.fromArray(cmp);
    data.insert(1);
    data.insert(2);
    data.insert(3);
    data.insert(2);

    data.removeOne(1);
    assert.deepStrictEqual(data.slice(), [2, 2, 3]);

    data.removeOne(2);
    assert.deepStrictEqual(data.slice(), [2, 3]);

    data.removeOne(2);
    assert.deepStrictEqual(data.slice(), [3]);

    data.removeOne(2);
    assert.deepStrictEqual(data.slice(), [3]);
  });

  it("should throw when using fromSortedArray and array is not sorted", () => {
    const data = [1, 3, 2];

    const tryToCreate = () => SortedArray.fromSortedArray(cmp, data);

    assert.throws(tryToCreate, new Error(`Expected sorted array, got: ${data}`));
  });

  it("should not throw when using fromSortedArray and array is sorted", () => {
    const data = [1, 2, 3];

    const result = SortedArray.fromSortedArray(cmp, data);

    assert.deepStrictEqual(result.slice(), data);
  });

  it("should not throw when using fromSortedArray and array is sorted and contains duplicates", () => {
    const data = [1, 2, 2, 3];

    const result = SortedArray.fromSortedArray(cmp, data);

    assert.deepStrictEqual(result.slice(), data);
  });

  describe("fromTwoSortedCollections", () => {
    it("should merge two sorted sets", () => {
      const arr1 = [1, 2, 3];
      const arr2 = [4, 5, 6];
      const toMerge1 = SortedArray.fromArray(cmp, arr1);
      const toMerge2 = SortedArray.fromArray(cmp, arr2);

      const result = SortedArray.fromTwoSortedCollections(toMerge1, toMerge2);

      assert.deepStrictEqual(result.slice(), [...arr1, ...arr2]);
    });

    it("should merge two sorted sets with duplicates", () => {
      const arr = [1, 2, 3];
      const toMerge1 = SortedArray.fromArray(cmp, arr);
      const toMerge2 = SortedArray.fromArray(cmp, arr);

      const result = SortedArray.fromTwoSortedCollections(toMerge1, toMerge2);

      assert.deepStrictEqual(result.slice(), [1, 1, 2, 2, 3, 3]);
    });
  });
});
