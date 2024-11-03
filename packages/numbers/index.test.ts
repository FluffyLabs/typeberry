import assert from "node:assert";
import { describe, it } from "node:test";
import { sumU32, u32 } from "./index";

describe("sumU32", () => {
  it("should sum and handle overflow", () => {
    const res1 = sumU32(u32(3), u32(5), u32(10));
    const res2 = sumU32(u32(2 ** 32 - 1), u32(1));
    const res3 = sumU32(u32(2 ** 32 - 1), u32(2 ** 32 - 1));
    const res4 = sumU32(u32(2 ** 32 - 1), u32(2 ** 32 - 1), u32(2 ** 32 - 1));

    assert.deepStrictEqual(res1, { overflow: false, value: u32(18) });
    assert.deepStrictEqual(res2, { overflow: true, value: u32(0) });
    assert.deepStrictEqual(res3, { overflow: true, value: u32(2 ** 32 - 2) });
    assert.deepStrictEqual(res4, { overflow: true, value: u32(2 ** 32 - 3) });
  });
});
