import assert from "node:assert";
import { describe, it } from "node:test";
import { type U32, sumU32 } from "./index";

describe("sumU32", () => {
  it("should sum and handle overflow", () => {
    const res1 = sumU32(3 as U32, 5 as U32, 10 as U32);
    const res2 = sumU32((2 ** 32 - 1) as U32, 1 as U32);
    const res3 = sumU32((2 ** 32 - 1) as U32, (2 ** 32 - 1) as U32);
    const res4 = sumU32((2 ** 32 - 1) as U32, (2 ** 32 - 1) as U32, (2 ** 32 - 1) as U32);

    assert.deepStrictEqual(res1, { overflow: false, value: 18 as U32 });
    assert.deepStrictEqual(res2, { overflow: true, value: 0 as U32 });
    assert.deepStrictEqual(res3, { overflow: true, value: (2 ** 32 - 2) as U32 });
    assert.deepStrictEqual(res4, { overflow: true, value: (2 ** 32 - 3) as U32 });
  });
});
