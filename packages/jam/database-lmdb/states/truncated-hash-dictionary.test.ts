import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { TRUNCATED_KEY_BYTES } from "@typeberry/trie";
import { TruncatedHashDictionary } from "./truncated-hash-dictionary.js";

describe("TruncatedHashDictionary", () => {
  it("should return undefined when dictionary is empty", () => {
    const queryKey = Bytes.parseBytes("0x1111111111111111111111111111111111111111111111111111111111111122", HASH_SIZE);

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
    const truncatedKey = Bytes.fromBlob(fullKey.raw.subarray(0, TRUNCATED_KEY_BYTES), TRUNCATED_KEY_BYTES);

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
    const queryKey = Bytes.parseBytes("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaff", HASH_SIZE);

    const dict = TruncatedHashDictionary.fromEntries([[insertedKey, "exists"]]);

    // when
    const res = dict.get(queryKey);

    // then
    assert.deepStrictEqual(res, undefined);
  });

  it("should not mutate original keys during fromEntries", () => {
    const original = Bytes.parseBytes("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaff", HASH_SIZE);
    const copyBefore = original.raw.slice(); // snapshot

    const dict = TruncatedHashDictionary.fromEntries([[original, "value"]]);

    // when
    dict.get(original); // access to possibly trigger mutation

    // then
    assert.deepStrictEqual(original.raw, copyBefore); // unchanged
  });
});
