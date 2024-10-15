import assert from "node:assert";
import { describe, it } from "node:test";
import { Ordering, SortedArray } from "./sorted-array";

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
    const data = new SortedArray(cmp, [5, 2, 3]);

    data.insert(1);
    data.insert(10);
    data.insert(-50);

    assert.deepStrictEqual(data.slice().toString(), [-50, 1, 2, 3, 5, 10].toString());
    assert.deepStrictEqual(data.length, 6);
  });

  it("should work with duplicates", () => {
    const data = new SortedArray(cmp);
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
    const data = new SortedArray(cmp);
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
    const data = new SortedArray(cmp);
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
});
