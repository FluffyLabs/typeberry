import assert from "node:assert";
import { describe, it } from "node:test";
import { check, inspect, lazyInspect, memoryTracker, memoryUsage } from "./debug.js";

describe("utils::check", () => {
  it("should do nothing if condition is met", () => {
    check`${true} I shall not fail!`;
  });

  it("should throw exception with message if condition is not met", () => {
    const num = 10;
    assert.throws(() => {
      check`${false} Oopsie ${4}, ${"!"} ${num}`;
    }, new Error("Assertion failure: Oopsie 4, ! 10"));
  });
});

describe("utils::lazyInspect", () => {
  it("should correctly print a map", () => {
    const map = new Map([
      ["a", 1],
      ["b", 2],
    ]);

    const lazyInspectedMap = `${lazyInspect(map)}`;
    const expected = inspect(map);

    assert.strictEqual(lazyInspectedMap, expected);
  });
});

describe("utils::memoryUsage", () => {
  it("should report all memory fields", () => {
    const usage = memoryUsage();
    for (const field of ["rss=", "heap=", "external=", "arrayBuffers="]) {
      assert.ok(usage.includes(field), `expected "${field}" in "${usage}"`);
    }
  });
});

describe("utils::memoryTracker", () => {
  it("should not include a delta on the first call", () => {
    const tracker = memoryTracker();
    assert.ok(!tracker().includes("Δrss"));
  });

  it("should include a delta on subsequent calls", () => {
    const tracker = memoryTracker();
    tracker();
    const second = tracker();
    assert.ok(second.includes("Δrss="), `expected delta in "${second}"`);
    assert.ok(second.includes("ΔarrayBuffers="), `expected delta in "${second}"`);
  });
});
