import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { HashSet } from "./hash-set.js";

function key(n: number) {
  return Bytes.fill(HASH_SIZE, n);
}

describe("HashSet", () => {
  it("should return true/false for keys present in the dictionary", () => {
    const set = HashSet.new();
    set.insert(key(1));
    set.insert(key(2));

    assert.deepStrictEqual(set.has(key(0)), false);
    assert.deepStrictEqual(set.has(key(1)), true);
    assert.deepStrictEqual(set.has(key(2)), true);
    assert.deepStrictEqual(set.has(key(3)), false);
  });

  it("should insert multiple elements", () => {
    const set = HashSet.new();
    set.insertAll([key(1), key(2)]);

    assert.deepStrictEqual(set.has(key(1)), true);
    assert.deepStrictEqual(set.has(key(2)), true);
  });

  it("should remove some values", () => {
    const dict = HashSet.new();
    dict.insert(key(1));
    dict.insert(key(2));
    assert.deepStrictEqual(dict.has(key(1)), true);
    assert.deepStrictEqual(dict.has(key(2)), true);

    dict.delete(key(0));
    dict.delete(key(1));
    dict.delete(key(3));

    assert.deepStrictEqual(dict.has(key(0)), false);
    assert.deepStrictEqual(dict.has(key(1)), false);
    assert.deepStrictEqual(dict.has(key(2)), true);
    assert.deepStrictEqual(dict.has(key(3)), false);
  });

  it("should return intersection of two sets", () => {
    const dict1 = HashSet.new();
    dict1.insertAll([key(1), key(2)]);

    const dict2 = HashSet.new();
    dict2.insertAll([key(2), key(3)]);

    const intersect1 = Array.from(dict1.intersection(dict2));
    const intersect2 = Array.from(dict2.intersection(dict1));

    assert.deepStrictEqual(intersect1.toString(), intersect2.toString());
    assert.deepStrictEqual(intersect1.toString(), "0x0202020202020202020202020202020202020202020202020202020202020202");
  });
});
