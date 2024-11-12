import assert from "node:assert";
import { describe, it } from "node:test";
import { BytesBlob } from "@typeberry/bytes";
import { WithHash, hashBytes, hashString } from "@typeberry/hash";
import type { StateKey, TrieHash } from "@typeberry/trie";
import { InMemoryKvdb } from ".";

function key(v: string): StateKey {
  return hashString(v).asOpaque();
}

const hash = (data: BytesBlob) => {
  const h: TrieHash = hashBytes(data).asOpaque();
  return new WithHash(h, data);
};

describe("InMemoryDatabase", () => {
  it("should write some data to the db", async () => {
    const db = new InMemoryKvdb();
    const tx = db.newTransaction();
    tx.insert(key("a"), hash(BytesBlob.blobFromString("hello world!")));
    tx.insert(key("b"), hash(BytesBlob.blobFromString("xyz")));
    assert.strictEqual(db.getRoot().toString(), "0x0000000000000000000000000000000000000000000000000000000000000000");

    await db.commit(tx);

    assert.strictEqual(db.getRoot().toString(), "0x18408cf941c7b3cb3ad8e431a283d812bdc087ce9a43c573498f5bbf1265f2a6");
    assert.deepStrictEqual(db.get(key("a")), BytesBlob.blobFromString("hello world!"));
    assert.deepStrictEqual(db.get(key("b")), BytesBlob.blobFromString("xyz"));
  });
});
