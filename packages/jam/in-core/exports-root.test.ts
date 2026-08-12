import assert from "node:assert";
import { before, describe, it } from "node:test";
import { SEGMENT_BYTES, type Segment } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Blake2b, HASH_SIZE } from "@typeberry/hash";
import { computeExportsRoot } from "./exports-root.js";

let blake2b: Blake2b;

before(async () => {
  blake2b = await Blake2b.createHasher();
});

function segment(value: number): Segment {
  return Bytes.fill(SEGMENT_BYTES, value).asOpaque();
}

describe("computeExportsRoot", () => {
  it("should return the zero hash when no segments are exported", () => {
    const result = computeExportsRoot([[], []], blake2b);

    assert.strictEqual(result.toString(), Bytes.zero(HASH_SIZE).toString());
  });

  it("should hash a single export as a leaf", () => {
    const result = computeExportsRoot([[segment(1)]], blake2b);

    assert.strictEqual(result.toString(), "0xbdd2e8e191e4e2cc8e7694014c0bd0c5be505b39799b42084216f2ce7b13d806");
  });

  it("should preserve work-item and per-item export order", () => {
    const result = computeExportsRoot([[segment(1), segment(3)], [segment(2)]], blake2b);

    assert.strictEqual(result.toString(), "0x2f464cb16bbadf8bb8e91ac9611756a75a9c3731d86e9840a9a965de5e8f3971");
  });

  it("should pad leaves with the zero hash to the next power of two", () => {
    const result = computeExportsRoot([[segment(1)], [segment(2), segment(3)]], blake2b);

    assert.strictEqual(result.toString(), "0x6456afa4f4f2aac3397a820ff818762fb9c4764c3837cf3e5b87f5841b4eb875");
  });

  it("should not pad an already balanced tree", () => {
    const result = computeExportsRoot(
      [
        [segment(1), segment(2)],
        [segment(3), segment(4)],
      ],
      blake2b,
    );

    assert.strictEqual(result.toString(), "0xf325f65371417918cfda39dee8a50501f44dd3528d603c8766d26d8b6cba4fb4");
  });
});
