import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { BytesBlob } from "@typeberry/bytes";
import { base32 } from "./base32";

describe("base32 encoding", () => {
  it("should encode to base32", () => {
    const bytes = BytesBlob.parseBlob("0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29");

    strictEqual(base32(bytes.raw), "3r2oc62zwfj3crnuifuvsxvbtlzetk4o5qyhetkhagsc2fgl2oka");
  });
});
