import assert from "node:assert";
import { describe, it } from "node:test";
import { hashConcat } from "@typeberry/blake2b";
import type { OpaqueHash } from "@typeberry/hash";
import type { MmrHasher } from ".";

const _hasher: MmrHasher<OpaqueHash> = {
  hashConcat(a, b) {
    return hashConcat(a.raw, [b.raw]);
  },
  hashConcatPrepend(id, a, b) {
    return hashConcat(id.raw, [a.raw, b.raw]);
  },
};

describe("MMR", () => {
  it("should return empty peaks and some super hash", () => {
    assert(false);
  });
});
