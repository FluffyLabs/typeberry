import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE, WithHash, blake2b } from "@typeberry/hash";
import { InMemoryPreimages } from "./preimage.js";

const hash = (data: BytesBlob) => {
  const hash = blake2b.hashBytes(data);
  return new WithHash(hash, data);
};
describe("InMemoryDatabase", () => {
  it("should set and retrieve some preimages", () => {
    const db = new InMemoryPreimages();

    const data1 = hash(Bytes.fill(HASH_SIZE, 5));
    const data2 = hash(Bytes.fill(HASH_SIZE, 7));
    const data3 = hash(Bytes.fill(HASH_SIZE, 9));

    db.set(data1, data2, data3);

    assert.strictEqual(db.get(data1.hash)?.hash, data1.hash);
    assert.strictEqual(db.get(data1.hash)?.data.toString(), data1.data.toString());
    assert.strictEqual(db.get(data3.hash)?.hash, data3.hash);
    assert.strictEqual(db.get(data3.hash)?.data.toString(), data3.data.toString());
  });
});
