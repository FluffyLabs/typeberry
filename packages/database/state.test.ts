import assert from "node:assert";
import { describe, it } from "node:test";
import { BytesBlob } from "@typeberry/bytes";
import { HashableBlob, hashString } from "@typeberry/hash";
import type { StateKey } from "@typeberry/trie";
import { InMemoryKvdb } from ".";

function key(v: string): StateKey {
  return hashString(v) as StateKey;
}

describe("InMemoryDatabase", () => {
  it("should write some data to the db", async () => {
    const db = new InMemoryKvdb();
    const tx = db.newTransaction();
    tx.insert(key("a"), new HashableBlob(BytesBlob.fromString("hello world!")));
    tx.insert(key("b"), new HashableBlob(BytesBlob.fromString("xyz")));
    assert.strictEqual(
      (await db.getRoot()).toString(),
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );

    await db.commit(tx);

    assert.strictEqual(
      (await db.getRoot()).toString(),
      "0x18408cf941c7b3cb3ad8e431a283d812bdc087ce9a43c573498f5bbf1265f2a6",
    );
    assert.deepStrictEqual(await db.get(key("a")), BytesBlob.fromString("hello world!"));
    assert.deepStrictEqual(await db.get(key("b")), BytesBlob.fromString("xyz"));
  });
});
