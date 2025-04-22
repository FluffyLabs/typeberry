import assert from "node:assert";
import { describe, it } from "node:test";
import { BytesBlob } from "@typeberry/bytes";
import { blake2b } from "@typeberry/hash";
import { type DbKey, InMemoryKvdb } from ".";

function key(v: string): DbKey {
  return blake2b.hashString(v).asOpaque();
}

describe("InMemoryDatabase", () => {
  it("should write some data to the db", async () => {
    const db = new InMemoryKvdb();

    const tx = db.newTransaction();
    tx.insert(key("a"), BytesBlob.blobFromString("hello world!"));
    tx.insert(key("b"), BytesBlob.blobFromString("xyz"));

    assert.deepStrictEqual(db.get(key("a")), null);
    assert.deepStrictEqual(db.get(key("b")), null);

    await db.commit(tx);

    assert.deepStrictEqual(db.get(key("a")), BytesBlob.blobFromString("hello world!"));
    assert.deepStrictEqual(db.get(key("b")), BytesBlob.blobFromString("xyz"));
  });
});
