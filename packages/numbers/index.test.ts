import assert from "node:assert";
import { describe, it } from "node:test";
import { sumU32, sumU64, tryAsU32, tryAsU64 } from "./index";

describe("sumU32", () => {
  it("should sum and handle overflow", () => {
    const res1 = sumU32(tryAsU32(3), tryAsU32(5), tryAsU32(10));
    const res2 = sumU32(tryAsU32(2 ** 32 - 1), tryAsU32(1));
    const res3 = sumU32(tryAsU32(2 ** 32 - 1), tryAsU32(2 ** 32 - 1));
    const res4 = sumU32(tryAsU32(2 ** 32 - 1), tryAsU32(2 ** 32 - 1), tryAsU32(2 ** 32 - 1));

    assert.deepStrictEqual(res1, { overflow: false, value: tryAsU32(18) });
    assert.deepStrictEqual(res2, { overflow: true, value: tryAsU32(0) });
    assert.deepStrictEqual(res3, { overflow: true, value: tryAsU32(2 ** 32 - 2) });
    assert.deepStrictEqual(res4, { overflow: true, value: tryAsU32(2 ** 32 - 3) });
  });
});

describe("sumU64", () => {
  it("should sum and handle overflow", () => {
    const res1 = sumU64(tryAsU64(3), tryAsU64(5), tryAsU64(10));
    const res2 = sumU64(tryAsU64(2 ** 64 - 1), tryAsU64(1));
    const res3 = sumU64(tryAsU64(2 ** 64 - 1), tryAsU64(2 ** 64 - 1));
    const res4 = sumU64(tryAsU64(2 ** 64 - 1), tryAsU64(2 ** 64 - 1), tryAsU64(2 ** 64 - 1));

    assert.deepStrictEqual(res1, { overflow: false, value: tryAsU64(18) });
    assert.deepStrictEqual(res2, { overflow: true, value: tryAsU64(0) });
    assert.deepStrictEqual(res3, { overflow: true, value: tryAsU64(2 ** 64 - 2) });
    assert.deepStrictEqual(res4, { overflow: true, value: tryAsU64(2 ** 64 - 3) });
  });
});
