import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { InMemoryTrie, type InputKey } from "@typeberry/trie";
import { blake2bTrieHasher } from "@typeberry/trie/hasher";
import { type Result, resultToString } from "@typeberry/utils";
import { LeafDb, type LeafDbError, type ValuesDb } from "./leaf-db";

describe("LeafDb", () => {
  it("should construct a LeafDb", () => {
    const leafDbRes = constructLeafDb([
      [Bytes.fill(HASH_SIZE, 1).asOpaque(), BytesBlob.blobFromString("val1")],
      [Bytes.fill(HASH_SIZE, 2).asOpaque(), BytesBlob.blobFromString("val2")],
    ]);
    const leafDb = assertOk(leafDbRes);

    // when
    const val1 = leafDb.get(Bytes.fill(HASH_SIZE, 1).asOpaque());
    const val2 = leafDb.get(Bytes.fill(HASH_SIZE, 2).asOpaque());
    const val3 = leafDb.get(Bytes.fill(HASH_SIZE, 3).asOpaque());

    assert.strictEqual(`${val1}`, `${BytesBlob.blobFromString("val1")}`);
    assert.strictEqual(`${val2}`, "0x76616c32");
    assert.strictEqual(val3, null);
  });

  it("should retrieve value from a DB", () => {
    const leafDbRes = constructLeafDb([
      [Bytes.fill(HASH_SIZE, 1).asOpaque(), Bytes.fill(128, 0xff)],
      [Bytes.fill(HASH_SIZE, 2).asOpaque(), Bytes.fill(129, 0xee)],
    ]);
    const leafDb = assertOk(leafDbRes);

    // when
    const val1 = leafDb.get(Bytes.fill(HASH_SIZE, 1).asOpaque());
    const val2 = leafDb.get(Bytes.fill(HASH_SIZE, 2).asOpaque());
    const val3 = leafDb.get(Bytes.fill(HASH_SIZE, 3).asOpaque());

    assert.strictEqual(`${val1}`, `${Bytes.fill(128, 0xff)}`);
    assert.strictEqual(`${val2}`, `${Bytes.fill(129, 0xee)}`);
    assert.strictEqual(val3, null);
  });

  it("should fail on invalid blob data", () => {
    const res = LeafDb.fromLeavesBlob(BytesBlob.blobFromNumbers([1, 2, 3]), dbFromRaw(new Map()));

    assert.strictEqual(`${resultToString(res)}`, "3 is not a multiply of 64: 0x010203\nError: 0");
  });
});

function assertOk(res: ReturnType<typeof constructLeafDb>) {
  if (res.isError) {
    assert.fail(`Expected LeafDb to be created correctly, got: ${resultToString(res)}`);
  }
  return res.ok;
}

function constructLeafDb(entries: [InputKey, BytesBlob][]): Result<LeafDb, LeafDbError> {
  const rawDb = new Map<string, BytesBlob>();
  const trie = InMemoryTrie.empty(blake2bTrieHasher);
  for (const [key, value] of entries) {
    const leafNode = trie.set(key, value);
    if (!leafNode.hasEmbeddedValue()) {
      // we need to put it to the DB, since it didn't fit into the leaf.
      rawDb.set(`${leafNode.getValueHash()}`, value);
    }
  }

  const leafNodes = Array.from(trie.nodes.leaves());
  const db = dbFromRaw(rawDb);

  return LeafDb.fromLeavesBlob(BytesBlob.blobFromParts(leafNodes.map((x) => x.node.raw)), db);
}

function dbFromRaw(rawDb: Map<string, BytesBlob>): ValuesDb {
  return {
    get(input: Uint8Array): Uint8Array {
      const key = BytesBlob.blobFrom(input);
      const v = rawDb.get(`${key}`);
      if (v === undefined) {
        throw new Error(`Missing key: ${key}`);
      }
      return v.raw;
    },
  };
}
