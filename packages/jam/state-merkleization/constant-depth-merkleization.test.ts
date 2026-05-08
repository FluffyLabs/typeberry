import assert from "node:assert";
import { before, describe, it } from "node:test";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Blake2b, HASH_SIZE } from "@typeberry/hash";
import { constantDepthMerkleRoot } from "./constant-depth-merkleization.js";

const LEAF_PREFIX = BytesBlob.blobFromString("leaf");
const NODE_PREFIX = BytesBlob.blobFromString("node");
const ZERO_HASH = Bytes.zero(HASH_SIZE);

let blake2b: Blake2b;

before(async () => {
  blake2b = await Blake2b.createHasher();
});

function hashLeaf(v: BytesBlob) {
  return blake2b.hashBlobs([LEAF_PREFIX, v]);
}

function hashNode(left: Bytes<typeof HASH_SIZE>, right: Bytes<typeof HASH_SIZE>) {
  return blake2b.hashBlobs([NODE_PREFIX, left, right]);
}

describe("constantDepthMerkleRoot", () => {
  it("returns zero hash for empty input", () => {
    const result = constantDepthMerkleRoot([], blake2b);

    assert.deepStrictEqual(result, ZERO_HASH);
  });

  it("returns H(leaf || v) for a single item", () => {
    const v = BytesBlob.blobFromString("alpha");

    const result = constantDepthMerkleRoot([v], blake2b);

    assert.deepStrictEqual(result, hashLeaf(v));
  });

  it("builds a one-level tree for two items", () => {
    const v0 = BytesBlob.blobFromString("alpha");
    const v1 = BytesBlob.blobFromString("beta");

    const result = constantDepthMerkleRoot([v0, v1], blake2b);

    const expected = hashNode(hashLeaf(v0), hashLeaf(v1));
    assert.deepStrictEqual(result, expected);
  });

  it("pads three items up to four leaves with zero hash", () => {
    const v0 = BytesBlob.blobFromString("alpha");
    const v1 = BytesBlob.blobFromString("beta");
    const v2 = BytesBlob.blobFromString("gamma");

    const result = constantDepthMerkleRoot([v0, v1, v2], blake2b);

    const left = hashNode(hashLeaf(v0), hashLeaf(v1));
    const right = hashNode(hashLeaf(v2), ZERO_HASH);
    const expected = hashNode(left, right);
    assert.deepStrictEqual(result, expected);
  });

  it("builds a balanced tree for four items without padding", () => {
    const v0 = BytesBlob.blobFromString("a");
    const v1 = BytesBlob.blobFromString("b");
    const v2 = BytesBlob.blobFromString("c");
    const v3 = BytesBlob.blobFromString("d");

    const result = constantDepthMerkleRoot([v0, v1, v2, v3], blake2b);

    const left = hashNode(hashLeaf(v0), hashLeaf(v1));
    const right = hashNode(hashLeaf(v2), hashLeaf(v3));
    const expected = hashNode(left, right);
    assert.deepStrictEqual(result, expected);
  });
});
