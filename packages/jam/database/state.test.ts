import assert from "node:assert";
import { describe, it } from "node:test";
import { BytesBlob } from "@typeberry/bytes";
import { WithHash, blake2b } from "@typeberry/hash";
import type { StateKey, TrieHash } from "@typeberry/trie";
import { InMemoryKvdb } from ".";

function key(v: string): StateKey {
  return blake2b.hashString(v).asOpaque();
}

const hash = (data: BytesBlob) => {
  const h: TrieHash = blake2b.hashBytes(data).asOpaque();
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

    assert.strictEqual(db.getRoot().toString(), "0x6f8f62991ca1c4e906ecb53838672376a462f7f29f75d16ce8fdc1bda1b2247b");
    assert.deepStrictEqual(db.get(key("a")), BytesBlob.blobFromString("hello world!"));
    assert.deepStrictEqual(db.get(key("b")), BytesBlob.blobFromString("xyz"));
  });
});
