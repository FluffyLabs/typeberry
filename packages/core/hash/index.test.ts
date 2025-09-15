import assert from "node:assert";
import { describe, it } from "node:test";
import { BytesBlob } from "@typeberry/bytes";
import { blake2b, PageAllocator } from "./index.js";

const allocator = new PageAllocator(128);

describe("Hash", () => {
  it("should hash given set of bytes", () => {
    const blob = BytesBlob.parseBlob("0x2fa3f686df876995167e7c2e5d74c4c7b6e48f8068fe0e44208344d480f7904c");

    const hash = blake2b.hashBytes(blob, allocator);

    assert.strictEqual(hash.toString(), "0x49f5a84b4c975b075b3be90fd3d1c024dce6575de10a1c0a6f77788503bb306d");
  });
});
