import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsBigGas } from "@typeberry/pvm-interface";
import { gasCounter } from "./gas.js";

describe("GasCounterU64", () => {
  it("should return false if there is no underflow", () => {
    const gas = gasCounter(tryAsBigGas(100));

    const underflow = gas.sub(tryAsBigGas(50));

    assert.strictEqual(underflow, false);
    assert.strictEqual(gas.get(), tryAsBigGas(50));
  });

  it("should return true if there is underflow", () => {
    const gas = gasCounter(tryAsBigGas(100));

    const underflow = gas.sub(tryAsBigGas(150));

    assert.strictEqual(underflow, true);
    assert.strictEqual(gas.get(), tryAsBigGas(0));
  });
});
