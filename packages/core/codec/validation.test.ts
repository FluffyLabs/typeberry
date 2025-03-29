import assert from "node:assert";
import { describe, it } from "node:test";
import { validateLength } from "./validation";

describe("Codec validation", () => {
  it("should throw when length is out of range", () => {
    const range = { minLength: 3, maxLength: 16 };
    assert.throws(() => {
      validateLength(range, 0, "info");
    }, new Error("info: length is below minimal. 0 < 3"));

    assert.throws(() => {
      validateLength(range, 17, "info");
    }, new Error("info: length is above maximal. 17 > 16"));

    // this should not throw
    validateLength(range, 16, "info");
  });
});
