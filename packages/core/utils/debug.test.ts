import assert from "node:assert";
import { describe, it } from "node:test";
import { check } from "./debug.js";

describe("utils::check", () => {
  it("should do nothing if condition is met", () => {
    check`${true} I shall not fail!`;
  });

  it("should throw exception with message if condition is not met", () => {
    const num = 10;
    assert.throws(() => {
      check`${false} Oopsie ${4}, ${"!"} ${num}`;
    }, new Error("Assertion failure:  Oopsie 4, ! 10"));
  });
});
