import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { asOpaqueType } from "@typeberry/utils";
import { ED25519_KEY_BYTES, ED25519_SIGNATURE_BYTES } from "./ed25519.js";
import { ed25519 } from "./index.js";

describe("crypto.ed25519", () => {
  it("should produce a signature and verify it", async () => {
    const key = await ed25519.privateKey(Bytes.zero(ed25519.ED25519_PRIV_KEY_BYTES));
    const message = Bytes.blobFromString("Hello world!");

    const signature = await ed25519.sign(key, message);

    assert.strictEqual(
      signature.toString(),
      "0x99a3ca1ebdaed52cce90360a5ed42b17a3d2b9a7a00d54b3d1c86dd515063fc48c339bbbd890a3c5373d9a16651da6de8e63cbf6034db417cc3e3538737e500e",
    );

    const result = await ed25519.verify([
      {
        signature,
        key: key.pubKey,
        message,
      },
    ]);

    assert.deepStrictEqual(result, [true]);
  });

  it("should verify a bunch of signatures using verify", async () => {
    const results = await ed25519.verify(
      VALID_EXAMPLES.concat({
        ...VALID_EXAMPLES[0],
        message: BytesBlob.blobFromString("hello world"),
      }),
    );

    assert.deepStrictEqual(results, [true, true, false]);
  });

  it("should verify a bunch of signatures using verifyBatch and return true", async () => {
    const results = await ed25519.verifyBatch(VALID_EXAMPLES);

    assert.strictEqual(results, true);
  });

  it("should verify a bunch of signatures using verifyBatch and return false", async () => {
    const results = await ed25519.verifyBatch(
      VALID_EXAMPLES.concat({
        ...VALID_EXAMPLES[0],
        message: BytesBlob.blobFromString("hello world"),
      }),
    );

    assert.strictEqual(results, false);
  });
});

const VALID_EXAMPLES: ed25519.Input<BytesBlob>[] = [
  {
    signature:
      "0xa3afee85825aefb49cfe10000b72d22321f6d562f89f57f56da813f62761130774e2540b2c0ce33da3c28fcbffe52ea0d1eccfbd859be46835128c4cc87fb50c",
    key: "0x5c7f34a4bd4f2d04076a8c6f9060a0c8d2c6bdd082ceb3eda7df381cb260faff",
    message: "0x6a616d5f617661696c61626c651835559f6ad24c3d86280d7725f696042094d83694947ad4a66be38b501e3d48",
  },
  {
    signature:
      "0xdbd50734b049bcc9e25f5c4d2d2b635e22ec1d4eefcc324863de9e1673bacb4b7ac4424a946abae83755908a3f77470776c160e7d5b42991c1b8914bfc16b700",
    key: "0xe68e0cf7f26c59f963b5846202d2327cc8bc0c4eff8cb9abd4012f9a71decf00",
    message: "0x6a616d5f617661696c61626c651835559f6ad24c3d86280d7725f696042094d83694947ad4a66be38b501e3d48",
  },
].map((x) => {
  return {
    signature: asOpaqueType(Bytes.parseBytes(x.signature, ED25519_SIGNATURE_BYTES)),
    key: asOpaqueType(Bytes.parseBytes(x.key, ED25519_KEY_BYTES)),
    message: BytesBlob.parseBlob(x.message),
  };
});
