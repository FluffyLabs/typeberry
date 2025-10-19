import assert from "node:assert";
import { describe, it } from "node:test";
import { BytesBlob } from "@typeberry/bytes";
import { BlobDictionary, ListNode } from "./blob-dictionary.js";

// describe("ListNode", () => {
//     it ("should", () => {
//         const node = ListNode.new()
//     });
// });

describe("Blob dictionary", () => {
  it("should add item to BlobDictionary and then return it", () => {
    const key = BytesBlob.parseBlob("0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef");
    const val = { a: 1 };
    const dict = BlobDictionary.new();

    assert.strictEqual(dict.has(key), false);

    dict.set(key, val);

    assert.strictEqual(dict.has(key), true);

    const result = dict.get(key);

    assert.deepStrictEqual(result, val);
  });

  it("should override existing item", () => {
    const key = BytesBlob.parseBlob("0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef");
    const val1 = { a: 1 };
    const val2 = { a: 2 };
    const dict = BlobDictionary.new();

    assert.strictEqual(dict.has(key), false);

    dict.set(key, val1);
    dict.set(key, val2);

    const result = dict.get(key);

    assert.deepStrictEqual(result, val2);
  });

  it("should add item to BlobDictionary and then remove it", () => {
    const key = BytesBlob.parseBlob("0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef");
    const val = { a: 1 };
    const dict = BlobDictionary.new();

    assert.strictEqual(dict.has(key), false);

    dict.set(key, val);

    assert.strictEqual(dict.has(key), true);

    dict.delete(key);

    assert.strictEqual(dict.has(key), false);
  });

  it("should add empty blob as key", () => {
    const key = BytesBlob.empty();
    const val = { a: 1 };
    const dict = BlobDictionary.new();

    assert.strictEqual(dict.has(key), false);

    dict.set(key, val);

    assert.strictEqual(dict.has(key), true);

    const result = dict.get(key);

    assert.deepStrictEqual(result, val);
  });
});
