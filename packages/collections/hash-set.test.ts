import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import {HashSet} from "./hash-set";

function key(n: number) {
  return Bytes.fill(HASH_SIZE, n);
}

describe("HashSet", () => {
  it("should return true/false for keys present in the dictionary", () => {
    const set = new HashSet();
    set.insert(key(1));
    set.insert(key(2));

    assert.deepStrictEqual(set.has(key(0)), false);
    assert.deepStrictEqual(set.has(key(1)), true);
    assert.deepStrictEqual(set.has(key(2)), true);
    assert.deepStrictEqual(set.has(key(3)), false);
  });

  it("should remove some values", () => {
    const dict = new HashSet();
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
});
