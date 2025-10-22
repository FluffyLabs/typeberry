import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { BlobDictionary } from "./blob-dictionary.js";

const TRESHOLDS = [0, 5, 10];

describe("Blob dictionary", () => {
  for (const treshold of TRESHOLDS) {
    describe(`BlobDictionary(${treshold})`, () => {
      it("should add item to BlobDictionary and then return it", () => {
        const key = BytesBlob.parseBlob("0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef");
        const val = { a: 1 };
        const dict = BlobDictionary.new(treshold);

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
        const dict = BlobDictionary.new(treshold);

        assert.strictEqual(dict.has(key), false);

        dict.set(key, val1);
        dict.set(key, val2);

        const result = dict.get(key);

        assert.deepStrictEqual(result, val2);
      });

      it("should add item to BlobDictionary and then remove it", () => {
        const key = BytesBlob.parseBlob("0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef");
        const val = { a: 1 };
        const dict = BlobDictionary.new(treshold);

        assert.strictEqual(dict.has(key), false);

        dict.set(key, val);

        assert.strictEqual(dict.has(key), true);

        dict.delete(key);

        assert.strictEqual(dict.has(key), false);
      });

      it("should add empty blob as key", () => {
        const key = BytesBlob.empty();
        const val = { a: 1 };
        const dict = BlobDictionary.new(treshold);

        assert.strictEqual(dict.has(key), false);

        dict.set(key, val);

        assert.strictEqual(dict.has(key), true);

        const result = dict.get(key);

        assert.deepStrictEqual(result, val);
      });

      it("should store a few items with the same prefix and then remove all of them", () => {
        const entries = [
          [BytesBlob.parseBlob("0x112233445566778899aabbccddeef1"), { index: 1 }] as const,
          [BytesBlob.parseBlob("0x112233445566778899aabbccddeef2"), { index: 2 }] as const,
          [BytesBlob.parseBlob("0x112233445566778899aabbccddeef3"), { index: 3 }] as const,
          [BytesBlob.parseBlob("0x112233445566778899aabbccddeef4"), { index: 4 }] as const,
          [BytesBlob.parseBlob("0x112233445566778899aabbccddeef5"), { index: 5 }] as const,
          [BytesBlob.parseBlob("0x112233445566778899aabbccddeef6"), { index: 6 }] as const,
          [BytesBlob.parseBlob("0x112233445566778899aabbccddeef7"), { index: 7 }] as const,
          [BytesBlob.parseBlob("0x112233445566778899aabbccddeef8"), { index: 8 }] as const,
          [BytesBlob.parseBlob("0x112233445566778899aabbccddeef9"), { index: 9 }] as const,
        ];

        const dict = BlobDictionary.new(3);

        for (const [key, val] of entries) {
          dict.set(key, val);
        }

        for (const [key, val] of entries) {
          const result = dict.get(key);
          assert.deepStrictEqual(val, result);
        }

        for (const [key] of entries) {
          dict.delete(key);
        }

        for (const [key] of entries) {
          assert.strictEqual(dict.has(key), false);
        }
      });

      function key(n: number) {
        return Bytes.fill(HASH_SIZE, n);
      }

      it("should return true/false for keys present in the dictionary", () => {
        const dict = BlobDictionary.new(treshold);
        dict.set(key(1), "Hello World!");
        dict.set(key(2), "Hello!");

        assert.deepStrictEqual(dict.has(key(0)), false);
        assert.deepStrictEqual(dict.has(key(1)), true);
        assert.deepStrictEqual(dict.has(key(2)), true);
        assert.deepStrictEqual(dict.has(key(3)), false);
      });

      it("should set and get some values", () => {
        const dict = BlobDictionary.new(treshold);
        dict.set(key(1), "Hello World!");
        dict.set(key(2), "Hello!");

        assert.deepStrictEqual(dict.get(key(0)), undefined);
        assert.deepStrictEqual(dict.get(key(1)), "Hello World!");
        assert.deepStrictEqual(dict.get(key(2)), "Hello!");
        assert.deepStrictEqual(dict.get(key(4)), undefined);
      });

      it("should remove some values", () => {
        const dict = BlobDictionary.new(treshold);
        dict.set(key(1), "Hello World!");
        dict.set(key(2), "Hello!");
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

      it("should iterate over values", () => {
        const dict = BlobDictionary.new(treshold);
        dict.set(key(1), "Hello World!");
        dict.set(key(2), "Hello!");

        const values = Array.from(dict.values());

        assert.deepStrictEqual(values, ["Hello World!", "Hello!"]);
      });

      it("should iterate over keys", () => {
        const dict = BlobDictionary.new(treshold);
        dict.set(key(1), "Hello World!");
        dict.set(key(2), "Hello!");

        const keys = Array.from(dict.keys());

        assert.deepStrictEqual(keys, [key(1), key(2)]);
      });

      it("should iterate over entries", () => {
        const dict = BlobDictionary.new(treshold);
        dict.set(key(1), "Hello World!");
        dict.set(key(2), "Hello!");

        const values = Array.from(dict);

        assert.deepStrictEqual(values, [
          [key(1), "Hello World!"],
          [key(2), "Hello!"],
        ]);
      });
    });
  }
});
