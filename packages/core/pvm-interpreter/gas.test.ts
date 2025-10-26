import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsBigGas, tryAsSmallGas } from "@typeberry/pvm-interface";
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

  it("should return correct gas consumed", () => {
    const gasSubs = [tryAsSmallGas(10), tryAsSmallGas(15), tryAsSmallGas(20)];
    const gas = gasCounter(tryAsBigGas(100));

    // when
    for (const g of gasSubs) {
      gas.sub(g);
    }

    // then
    assert.deepStrictEqual(gas.used(), tryAsBigGas(10 + 15 + 20));
  });

  it("should return cap to initial gas when consumed gas goes into negative", () => {
    const initialGas = tryAsBigGas(100);
    const gas = gasCounter(initialGas);
    const gasCost = tryAsSmallGas(11);
    const maxSteps = 10;
    let i = 0;

    // when
    while (!gas.sub(gasCost) && i < maxSteps) {
      i++;
    }

    // then
    assert.deepStrictEqual(gas.used(), initialGas);
  });
});
