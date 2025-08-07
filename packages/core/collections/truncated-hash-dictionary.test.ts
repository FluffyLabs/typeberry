import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE, type OpaqueHash, TRUNCATED_HASH_SIZE } from "@typeberry/hash";
import { TruncatedHashDictionary } from "./truncated-hash-dictionary.js";

describe("TruncatedHashDictionary", () => {
  describe("get", () => {
    it("should return undefined when dictionary is empty", () => {
      const queryKey = Bytes.parseBytes(
        "0x1111111111111111111111111111111111111111111111111111111111111122",
        HASH_SIZE,
      );

      const dict = TruncatedHashDictionary.fromEntries([]);

      // when
      const res = dict.get(queryKey);

      // then
      assert.deepStrictEqual(res, undefined);
    });

    it("should retrieve the value if key differs at last byte", () => {
      const key1 = Bytes.parseBytes("0x11111111111111111111111111111111111111111111111111111111111111aa", HASH_SIZE);
      const key2 = Bytes.parseBytes("0x11111111111111111111111111111111111111111111111111111111111111ff", HASH_SIZE);

      const dict = TruncatedHashDictionary.fromEntries([
        [key1, "abc"],
        [Bytes.fill(HASH_SIZE, 2), "def"],
      ]);

      // when
      const res1 = dict.get(key1);
      const res2 = dict.get(key2);

      // then
      assert.deepStrictEqual(res1, "abc");
      assert.deepStrictEqual(res1, res2);
    });

    it("should return the value from the last entry if truncated keys collide", () => {
      const key1 = Bytes.parseBytes("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa01", HASH_SIZE);
      const key2 = Bytes.parseBytes("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaff", HASH_SIZE);

      const dict = TruncatedHashDictionary.fromEntries([
        [key1, "first"],
        [key2, "second"], // same prefix, should override
      ]);

      // when
      const res = dict.get(key1);

      // then
      assert.deepStrictEqual(res, "second");
    });

    it("should retrieve the value when using a truncated key for lookup", () => {
      const fullKey = Bytes.parseBytes("0xababababababababababababababababababababababababababababababab00", HASH_SIZE);
      const truncatedKey = Bytes.fromBlob(fullKey.raw.subarray(0, TRUNCATED_HASH_SIZE), TRUNCATED_HASH_SIZE);

      const dict = TruncatedHashDictionary.fromEntries([[fullKey, "value"]]);

      // when
      const res = dict.get(truncatedKey);

      // then
      assert.deepStrictEqual(res, "value");
    });

    it("should return undefined for a key with a different truncated prefix", () => {
      const insertedKey = Bytes.parseBytes(
        "0x99999999999999999999999999999999999999999999999999999999999999ff",
        HASH_SIZE,
      );
      const queryKey = Bytes.parseBytes(
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaff",
        HASH_SIZE,
      );

      const dict = TruncatedHashDictionary.fromEntries([[insertedKey, "exists"]]);

      // when
      const res = dict.get(queryKey);

      // then
      assert.deepStrictEqual(res, undefined);
    });

    it("should not mutate original keys during fromEntries", () => {
      const original = Bytes.parseBytes(
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaff",
        HASH_SIZE,
      );
      const copyBefore = original.raw.slice(); // snapshot

      const dict = TruncatedHashDictionary.fromEntries([[original, "value"]]);

      // when
      dict.get(original); // access to possibly trigger mutation

      // then
      assert.deepStrictEqual(original.raw, copyBefore); // unchanged
    });
  });

  describe("set", () => {
    it("should set a new key-value pair", () => {
      const key = Bytes.parseBytes("0x1111111111111111111111111111111111111111111111111111111111111111", HASH_SIZE);
      const dict = TruncatedHashDictionary.fromEntries([]);

      // when
      dict.set(key, "new value");

      // then
      assert.deepStrictEqual(dict.get(key), "new value");
    });

    it("should update an existing key", () => {
      const key = Bytes.parseBytes("0x2222222222222222222222222222222222222222222222222222222222222222", HASH_SIZE);
      const dict = TruncatedHashDictionary.fromEntries([[key, "original"]]);

      // when
      dict.set(key, "updated");

      // then
      assert.deepStrictEqual(dict.get(key), "updated");
    });

    it("should set with truncated keys", () => {
      const fullKey = Bytes.parseBytes("0x3333333333333333333333333333333333333333333333333333333333333333", HASH_SIZE);
      const truncatedKey = Bytes.fromBlob(fullKey.raw.subarray(0, TRUNCATED_HASH_SIZE), TRUNCATED_HASH_SIZE);
      const dict = TruncatedHashDictionary.fromEntries([]);

      // when
      dict.set(truncatedKey, "truncated value");

      // then
      assert.deepStrictEqual(dict.get(fullKey), "truncated value");
      assert.deepStrictEqual(dict.get(truncatedKey), "truncated value");
    });

    it("should overwrite when setting keys with same truncated prefix", () => {
      const key1 = Bytes.parseBytes("0x4444444444444444444444444444444444444444444444444444444444444401", HASH_SIZE);
      const key2 = Bytes.parseBytes("0x44444444444444444444444444444444444444444444444444444444444444ff", HASH_SIZE);
      const dict = TruncatedHashDictionary.fromEntries([[key1, "first"]]);

      // when
      dict.set(key2, "second");

      // then
      assert.deepStrictEqual(dict.get(key1), "second");
      assert.deepStrictEqual(dict.get(key2), "second");
    });

    it("should not reuse the same key object reference for different entries", () => {
      const key1 = Bytes.parseBytes("0x4444444444444444444444444444444444444444444444444444444444444444", HASH_SIZE);
      const key2 = Bytes.parseBytes("0x5555555555555555555555555555555555555555555555555555555555555555", HASH_SIZE);
      const dict = TruncatedHashDictionary.fromEntries([]);

      dict.set(key1, "first");
      dict.set(key2, "second");

      const keys: OpaqueHash[] = [];

      for (const [key, _] of dict) {
        keys.push(key);
      }

      assert.strictEqual([...new Set(keys)].length, 2);
    });
  });

  describe("delete", () => {
    it("should delete an existing key", () => {
      const key = Bytes.parseBytes("0x5555555555555555555555555555555555555555555555555555555555555555", HASH_SIZE);
      const dict = TruncatedHashDictionary.fromEntries([[key, "to delete"]]);

      // when
      dict.delete(key);

      // then
      assert.deepStrictEqual(dict.get(key), undefined);
    });

    it("should handle deleting a non-existent key", () => {
      const key = Bytes.parseBytes("0x6666666666666666666666666666666666666666666666666666666666666666", HASH_SIZE);
      const dict = TruncatedHashDictionary.fromEntries([]);

      // when
      dict.delete(key);

      // then
      assert.deepStrictEqual(dict.get(key), undefined);
    });

    it("should delete with truncated keys", () => {
      const fullKey = Bytes.parseBytes("0x7777777777777777777777777777777777777777777777777777777777777777", HASH_SIZE);
      const truncatedKey = Bytes.fromBlob(fullKey.raw.subarray(0, TRUNCATED_HASH_SIZE), TRUNCATED_HASH_SIZE);
      const dict = TruncatedHashDictionary.fromEntries([[fullKey, "to delete"]]);

      // when
      dict.delete(truncatedKey);

      // then
      assert.deepStrictEqual(dict.get(fullKey), undefined);
      assert.deepStrictEqual(dict.get(truncatedKey), undefined);
    });

    it("should delete when keys have same truncated prefix", () => {
      const key1 = Bytes.parseBytes("0x8888888888888888888888888888888888888888888888888888888888888801", HASH_SIZE);
      const key2 = Bytes.parseBytes("0x88888888888888888888888888888888888888888888888888888888888888ff", HASH_SIZE);
      const dict = TruncatedHashDictionary.fromEntries([[key1, "value"]]);

      // when
      dict.delete(key2);

      // then
      assert.deepStrictEqual(dict.get(key1), undefined);
      assert.deepStrictEqual(dict.get(key2), undefined);
    });
  });
});
