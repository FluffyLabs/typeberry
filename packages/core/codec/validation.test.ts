import assert from "node:assert";
import { describe, it } from "node:test";
import { validateLength } from "./validation";

describe("Codec validation", () => {
  it("should throw when length is out of range", () => {
    const range = { minLength: 3, maxLength: 16 };
    assert.throws(() => {
      validateLength(range, 0, "info");
    }, new Error("xx"));

    assert.throws(() => {
      validateLength(range, 17, "info");
    }, new Error("xx"));

    // this should not throw
    validateLength(range, 16, "info");
  });
});
