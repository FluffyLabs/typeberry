import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tryAsGas } from "@typeberry/pvm-interface";
import { BigGasCounter, createGasCounter, FastGasCounter } from "./gas.js";

describe("FastGasCounter", () => {
  it("subOne: counts down correctly", () => {
    const gc = new FastGasCounter(tryAsGas(3));
    assert.equal(gc.subOne(), false);
    assert.equal(gc.subOne(), false);
    assert.equal(gc.subOne(), false);
    assert.equal(gc.subOne(), true); // 4th -> OOG
  });

  it("subOne: gas=0 -> OOG immediately", () => {
    const gc = new FastGasCounter(tryAsGas(0));
    assert.equal(gc.subOne(), true);
  });

  it("subOne: gas=1 -> one step then OOG", () => {
    const gc = new FastGasCounter(tryAsGas(1));
    assert.equal(gc.subOne(), false);
    assert.equal(gc.subOne(), true);
  });

  it("get: returns remaining gas", () => {
    const gc = new FastGasCounter(tryAsGas(5));
    gc.subOne();
    gc.subOne();
    assert.equal(Number(gc.get()), 3);
  });

  it("used: returns consumed gas", () => {
    const gc = new FastGasCounter(tryAsGas(10));
    gc.subOne();
    gc.subOne();
    gc.subOne();
    assert.equal(Number(gc.used()), 3);
  });

  it("sub: subtracts bulk gas", () => {
    const gc = new FastGasCounter(tryAsGas(10));
    assert.equal(gc.sub(tryAsGas(5)), false);
    assert.equal(Number(gc.get()), 5);
  });

  it("sub: exact amount -> no OOG", () => {
    const gc = new FastGasCounter(tryAsGas(10));
    assert.equal(gc.sub(tryAsGas(10)), false);
    assert.equal(Number(gc.get()), 0);
  });

  it("sub: more than remaining -> OOG", () => {
    const gc = new FastGasCounter(tryAsGas(10));
    assert.equal(gc.sub(tryAsGas(11)), true);
  });

  it("set: throws error (not supported)", () => {
    const gc = new FastGasCounter(tryAsGas(10));
    assert.throws(() => gc.set(tryAsGas(5)), /FastGasCounter.set\(\) is not supported/);
  });
});

describe("BigGasCounter", () => {
  it("subOne: handles gas > MAX_SAFE_INTEGER", () => {
    const bigGas = tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 100n);
    const gc = new BigGasCounter(bigGas);
    assert.equal(gc.subOne(), false);
    assert.equal(BigInt(gc.get()), BigInt(Number.MAX_SAFE_INTEGER) + 99n);
  });

  it("subOne: small gas exhausts correctly", () => {
    const gc = new BigGasCounter(tryAsGas(2));
    assert.equal(gc.subOne(), false);
    assert.equal(gc.subOne(), false);
    assert.equal(gc.subOne(), true);
  });

  it("subOne: gas=0 -> OOG immediately", () => {
    const gc = new BigGasCounter(tryAsGas(0));
    assert.equal(gc.subOne(), true);
  });

  it("get: returns correct total for large values", () => {
    const val = BigInt(Number.MAX_SAFE_INTEGER) + 42n;
    const gc = new BigGasCounter(tryAsGas(val));
    assert.equal(BigInt(gc.get()), val);
  });

  it("used: tracks correctly across overflow boundary", () => {
    const bigGas = tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 10n);
    const gc = new BigGasCounter(bigGas);
    gc.subOne();
    gc.subOne();
    gc.subOne();
    assert.equal(BigInt(gc.used()), 3n);
  });

  it("sub: large cost within range", () => {
    const bigGas = tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 1000n);
    const gc = new BigGasCounter(bigGas);
    assert.equal(gc.sub(tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 500n)), false);
    assert.equal(BigInt(gc.get()), 500n);
  });

  it("sub: cost exceeds remaining -> OOG", () => {
    const bigGas = tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 1000n);
    const gc = new BigGasCounter(bigGas);
    gc.sub(tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 500n));
    assert.equal(gc.sub(tryAsGas(501)), true);
  });

  it("sub: small cost on large gas", () => {
    const bigGas = tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 100n);
    const gc = new BigGasCounter(bigGas);
    assert.equal(gc.sub(tryAsGas(50)), false);
    assert.equal(BigInt(gc.get()), BigInt(Number.MAX_SAFE_INTEGER) + 50n);
  });

  it("sub: exact amount -> no OOG", () => {
    const gc = new BigGasCounter(tryAsGas(100));
    assert.equal(gc.sub(tryAsGas(100)), false);
    assert.equal(BigInt(gc.get()), 0n);
  });

  it("sub: cost > MAX_SAFE_INTEGER on large gas", () => {
    const gas = BigInt(Number.MAX_SAFE_INTEGER) * 3n;
    const gc = new BigGasCounter(tryAsGas(gas));
    const cost = BigInt(Number.MAX_SAFE_INTEGER) * 2n;
    assert.equal(gc.sub(tryAsGas(cost)), false);
    assert.equal(BigInt(gc.get()), BigInt(Number.MAX_SAFE_INTEGER));
  });

  it("set: resets to large value", () => {
    const gc = new BigGasCounter(tryAsGas(100));
    gc.subOne();
    gc.set(tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 50n));
    assert.equal(BigInt(gc.get()), BigInt(Number.MAX_SAFE_INTEGER) + 50n);
  });

  it("set: resets to small value", () => {
    const bigGas = tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 100n);
    const gc = new BigGasCounter(bigGas);
    gc.set(tryAsGas(42));
    assert.equal(BigInt(gc.get()), 42n);
  });

  it("set: resets to zero", () => {
    const gc = new BigGasCounter(tryAsGas(100));
    gc.set(tryAsGas(0));
    assert.equal(BigInt(gc.get()), 0n);
    assert.equal(gc.subOne(), true);
  });
});

describe("createGasCounter", () => {
  it("selects FastGasCounter for small values", () => {
    const gc = createGasCounter(tryAsGas(1000));
    assert.ok(gc instanceof FastGasCounter);
  });

  it("selects BigGasCounter for large values", () => {
    const gc = createGasCounter(tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 1n));
    assert.ok(gc instanceof BigGasCounter);
  });

  it("selects FastGasCounter for MAX_SAFE_INTEGER exactly", () => {
    const gc = createGasCounter(tryAsGas(Number.MAX_SAFE_INTEGER));
    assert.ok(gc instanceof FastGasCounter);
  });

  it("forceBigGas: uses BigGasCounter even for small values", () => {
    const gc = createGasCounter(tryAsGas(100), true);
    assert.ok(gc instanceof BigGasCounter);
  });

  it("forceBigGas: set() works on small-value BigGasCounter", () => {
    const gc = createGasCounter(tryAsGas(100), true);
    gc.set(tryAsGas(BigInt(Number.MAX_SAFE_INTEGER) + 1n));
    assert.equal(BigInt(gc.get()), BigInt(Number.MAX_SAFE_INTEGER) + 1n);
  });
});
