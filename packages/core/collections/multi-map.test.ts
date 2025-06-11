import assert from "node:assert";
import { describe, it } from "node:test";
import { MultiMap } from "./multi-map.js";

function dump(map: Map<unknown, unknown>) {
  return JSON.stringify(map, (_key, val) => {
    if (val instanceof Map) {
      return Object.fromEntries(val.entries());
    }
    return val;
  });
}

describe("Multi Map", () => {
  it("should insert a bunch of values and create nested maps", () => {
    class MyObject {
      constructor(public readonly val: number) {}
    }

    type MyMap = MultiMap<[string, MyObject, number], string>;

    // given
    const map: MyMap = new MultiMap(3, [null, (obj) => obj.val, null]);
    map
      .set("hello", "a", new MyObject(5), 10)
      .set("world", "b", new MyObject(10), 10)
      .set("frens", "a", new MyObject(5), 11);

    // when
    const val_a = map.get("a", new MyObject(5), 10);
    const val_b = map.get("b", new MyObject(10), 10);
    const val_c = map.get("a", new MyObject(5), 11);
    const val_d = map.get("b", new MyObject(4), 10);

    // then
    assert.deepStrictEqual(dump(map.data), '{"a":{"5":{"10":"hello","11":"frens"}},"b":{"10":{"10":"world"}}}');
    assert.strictEqual(val_a, "hello");
    assert.strictEqual(val_b, "world");
    assert.strictEqual(val_c, "frens");
    assert.strictEqual(val_d, undefined);
  });

  it("should check existence and remove elements", () => {
    // given
    const map: MultiMap<[string, number], string> = new MultiMap(2);
    map.set("hello", "a", 10).set("world", "b", 10).set("frens", "a", 11);

    // when
    const has_a = map.has("a", 10);
    const has_b = map.has("b", 10);
    const has_c = map.has("a", 11);
    const has_d = map.has("b", 11);

    map.delete("b", 10);
    map.delete("b", 11); // noop

    const has_b2 = map.has("b", 10);
    const has_d2 = map.has("b", 11);

    // then
    assert.deepStrictEqual(dump(map.data), '{"a":{"10":"hello","11":"frens"},"b":{}}');
    assert.deepStrictEqual([has_a, has_b, has_c, has_d], [true, true, true, false]);
    assert.deepStrictEqual([has_b2, has_d2], [false, false]);
  });
});
