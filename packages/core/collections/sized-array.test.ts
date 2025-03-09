import assert from "node:assert";
import { describe, it } from "node:test";
import { FixedSizeArray } from "./sized-array";

describe("FixedSizeArray", () => {
  it("should verify length", () => {
    const data = ["a", "b", "c"];

    assert.throws(
      () => {
        return FixedSizeArray.new(data, 4);
      },
      {
        name: "Error",
        message: "Assertion failure: Expected an array of size: 4, got: 3",
      },
    );
  });

  it("should prevent adding/removing items", () => {
    const data = [1, 2, 3, 4, 5];
    const arr = FixedSizeArray.new(data, 5);

    assert.throws(
      () => {
        arr.push(1);
      },
      {
        name: "TypeError",
        message: "Cannot add property 5, object is not extensible",
      },
    );
  });

  it("should allow modifications of items", () => {
    const data = [1, 2, 3, 4, 5];
    const arr = FixedSizeArray.new(data, 5);
    assert.strictEqual(arr.length, 5);
    assert.strictEqual(arr[3], 4);
    arr[3] = 6;
    assert.strictEqual(arr[3], 6);
  });

  it("should not create an array of undefined items if the only item passed as data is a number", () => {
    const data = [20];
    const arr = FixedSizeArray.new(data, 1);

    assert.strictEqual(arr[0], 20);
    assert.strictEqual(arr.length, 1);
  });
});
