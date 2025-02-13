import assert from "node:assert";
import { describe, it } from "node:test";

import { BytesBlob } from "@typeberry/bytes";
import { getRingCommitment } from "./bandersnatch";

const bandersnatchKeys = [
  {
    bandersnatch: "0xaa2b95f7572875b0d0f186552ae745ba8222fc0b5bd456554bfe51c68938f8bc",
  },
  {
    bandersnatch: "0xf16e5352840afb47e206b5c89f560f2611835855cf2e6ebad1acc9520a72591d",
  },
  {
    bandersnatch: "0x5e465beb01dbafe160ce8216047f2155dd0569f058afd52dcea601025a8d161d",
  },
  {
    bandersnatch: "0x48e5fcdce10e0b64ec4eebd0d9211c7bac2f27ce54bca6f7776ff6fee86ab3e3",
  },
  {
    bandersnatch: "0x3d5e5a51aab2b048f8686ecd79712a80e3265a114cc73f14bdb2a59233fb66d0",
  },
  {
    bandersnatch: "0x7f6190116d118d643a98878e294ccf62b509e214299931aad8ff9764181a4e33",
  },
].reduce(
  (acc, item, i) => {
    acc.set(BytesBlob.parseBlob(item.bandersnatch).raw, i * 32);
    return acc;
  },
  new Uint8Array(32 * 6),
);

describe("Bandersnatch verification", () => {
  describe("getRingCommitment", () => {
    it("should return commitment", async () => {
      const result = await getRingCommitment(bandersnatchKeys);
      const expectedCommitment = BytesBlob.parseBlob(
        "0xb3750bba87e39fb38579c880ff3b5c4e0aa90df8ff8be1ddc5fdd615c6780955f8fd85d99fd92a3f1d4585eb7ae8d627b01dd76d41720d73c9361a1dd2e830871155834c55db72de38fb875a9470faedb8cae54b34f7bfe196a9caca00c2911592e630ae2b14e758ab0960e372172203f4c9a41777dadd529971d7ab9d23ab29fe0e9c85ec450505dde7f5ac038274cf",
      );

      assert.strictEqual(result.isOk, true);
      assert.deepStrictEqual(result.ok, expectedCommitment);
    });
  });

  describe("verifyTickets", () => {
    // TODO [MaSi]: tests
  });
});
