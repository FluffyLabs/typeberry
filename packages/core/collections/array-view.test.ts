import assert from "node:assert";
import { describe, it } from "node:test";
import { deepEqual } from "@typeberry/utils";
import { ArrayView } from "./array-view.js";

describe("ArrayView", () => {
  const arr = [10, 20, 30, 40, 50];

  it("creates a view from array", () => {
    const view = ArrayView.from(arr, 1, 4);
    assert.deepEqual(view.length, 3);
    deepEqual([...view], [20, 30, 40]);
  });

  it("throws on invalid range", () => {
    assert.throws(() => ArrayView.from(arr, -1, 3), /Invalid start\/end for ArrayView/);
    assert.throws(() => ArrayView.from(arr, 2, 10), /Invalid start\/end for ArrayView/);
    assert.throws(() => ArrayView.from(arr, 4, 1), /Invalid start\/end for ArrayView/);
  });

  it("supports get()", () => {
    const view = ArrayView.from(arr, 0, 3);
    assert.equal(view.get(0), 10);
    assert.equal(view.get(2), 30);
    assert.throws(() => view.get(-1), /Index out of bounds./);
    assert.throws(() => view.get(3), /Index out of bounds./);
  });

  it("creates subview correctly", () => {
    const view = ArrayView.from(arr, 1, 5); // [20,30,40,50]
    const sub = view.subview(1, 3); // [30,40]
    deepEqual([...sub], [30, 40]);
    assert.strictEqual(sub.length, 2);
    const subToEnd = view.subview(2); // [40,50]
    deepEqual([...subToEnd], [40, 50]);
    assert.strictEqual(subToEnd.length, 2);
  });

  it("toArray() produces a copy", () => {
    const view = ArrayView.from(arr, 1, 4);
    const copy = view.toArray();
    assert.deepEqual(copy, [20, 30, 40]);
    copy[0] = 999;
    assert.strictEqual(arr[1], 20);
  });

  it("works with for-of and spread", () => {
    const view = ArrayView.from(arr, 2, 5); // [30,40,50]
    const collected: number[] = [];
    for (const x of view) {
      collected.push(x);
    }
    deepEqual(collected, [30, 40, 50]);
    deepEqual([...view], [30, 40, 50]);
  });
});
