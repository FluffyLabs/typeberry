import assert from "node:assert";
import { describe, it } from "node:test";
import { MAX_LENGTH, safeAllocUint8Array } from "./safe-alloc-uint8array.js";

describe("safeAllocUint8Array", () => {
  it("should allocate a Uint8Array with the given length", () => {
    const length = 1000;
    const arr = safeAllocUint8Array(length);
    assert.equal(length, arr.length);
  });

  it("should clamp the length to the maximum length", () => {
    const length = MAX_LENGTH + 100;
    const arr = safeAllocUint8Array(length);
    assert.equal(MAX_LENGTH, arr.length);
  });
});
