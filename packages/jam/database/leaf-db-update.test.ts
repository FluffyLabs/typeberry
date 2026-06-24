import assert from "node:assert";
import { before, describe, it } from "node:test";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { SortedSet } from "@typeberry/collections";
import { Blake2b, HASH_SIZE } from "@typeberry/hash";
import { StateEntryUpdateAction, type StateKey } from "@typeberry/state-merkleization";
import { type LeafNode, leafComparator } from "@typeberry/trie";
import { updateLeafs } from "./leaf-db-update.js";

let blake2b: Blake2b;

before(async () => {
  blake2b = await Blake2b.createHasher();
});

function key(n: number): StateKey {
  return Bytes.fill(HASH_SIZE, n).asOpaque();
}

/** A value larger than 32 bytes, so it does not fit into the leaf and is hash-referenced. */
function bigValue(b: number): BytesBlob {
  return Bytes.fill(64, b);
}

/** A value that fits directly into the leaf node. */
function smallValue(b: number): BytesBlob {
  return Bytes.fill(4, b);
}

function emptyLeafs(): SortedSet<LeafNode> {
  return SortedSet.fromArray<LeafNode>(leafComparator, []);
}

function asStrings(hashes: { toString(): string }[]): string[] {
  return hashes.map((h) => h.toString());
}

describe("updateLeafs", () => {
  it("collects a freshly inserted non-embedded value and removes nothing", () => {
    const leafs = emptyLeafs();

    const res = updateLeafs(leafs, blake2b, [[StateEntryUpdateAction.Insert, key(1), bigValue(0xaa)]]);

    assert.strictEqual(res.values.length, 1);
    assert.deepStrictEqual(res.removed, []);
  });

  it("collects nothing for an embedded value", () => {
    const leafs = emptyLeafs();

    const res = updateLeafs(leafs, blake2b, [[StateEntryUpdateAction.Insert, key(1), smallValue(0xaa)]]);

    assert.deepStrictEqual(res.values, []);
    assert.deepStrictEqual(res.removed, []);
  });

  it("emits the displaced value hash in `removed` when a leaf is replaced", () => {
    const leafs = emptyLeafs();
    const first = updateLeafs(leafs, blake2b, [[StateEntryUpdateAction.Insert, key(1), bigValue(0xaa)]]);
    const oldHash = first.values[0][0];

    const res = updateLeafs(leafs, blake2b, [[StateEntryUpdateAction.Insert, key(1), bigValue(0xbb)]]);

    assert.strictEqual(res.values.length, 1);
    assert.deepStrictEqual(asStrings(res.removed), asStrings([oldHash]));
  });

  it("cancels out when the same value is re-inserted at the same key", () => {
    const leafs = emptyLeafs();
    updateLeafs(leafs, blake2b, [[StateEntryUpdateAction.Insert, key(1), bigValue(0xaa)]]);

    const res = updateLeafs(leafs, blake2b, [[StateEntryUpdateAction.Insert, key(1), bigValue(0xaa)]]);

    assert.deepStrictEqual(res.values, []);
    assert.deepStrictEqual(res.removed, []);
  });

  it("emits the old hash when a non-embedded value becomes embedded", () => {
    const leafs = emptyLeafs();
    const first = updateLeafs(leafs, blake2b, [[StateEntryUpdateAction.Insert, key(1), bigValue(0xaa)]]);
    const oldHash = first.values[0][0];

    const res = updateLeafs(leafs, blake2b, [[StateEntryUpdateAction.Insert, key(1), smallValue(0xbb)]]);

    assert.deepStrictEqual(res.values, []);
    assert.deepStrictEqual(asStrings(res.removed), asStrings([oldHash]));
  });

  it("emits the removed value hash when a non-embedded leaf is removed", () => {
    const leafs = emptyLeafs();
    const first = updateLeafs(leafs, blake2b, [[StateEntryUpdateAction.Insert, key(1), bigValue(0xaa)]]);
    const oldHash = first.values[0][0];

    const res = updateLeafs(leafs, blake2b, [[StateEntryUpdateAction.Remove, key(1), BytesBlob.empty()]]);

    assert.deepStrictEqual(res.values, []);
    assert.deepStrictEqual(asStrings(res.removed), asStrings([oldHash]));
  });

  it("removes nothing when an embedded leaf is removed", () => {
    const leafs = emptyLeafs();
    updateLeafs(leafs, blake2b, [[StateEntryUpdateAction.Insert, key(1), smallValue(0xaa)]]);

    const res = updateLeafs(leafs, blake2b, [[StateEntryUpdateAction.Remove, key(1), BytesBlob.empty()]]);

    assert.deepStrictEqual(res.values, []);
    assert.deepStrictEqual(res.removed, []);
  });
});
