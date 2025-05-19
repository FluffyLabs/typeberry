import crypto, { createPublicKey } from "node:crypto";
import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup.js";
import { BytesBlob } from "@typeberry/bytes";
import { ed25519 } from "@typeberry/crypto";
import type { Input } from "@typeberry/crypto/ed25519.js";

const key = BytesBlob.parseBlob("0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29");
const message = BytesBlob.parseBlob(
  "0x6a616d5f67756172616e74656511da6d1f761ddf9bdb4c9d6e5303ebd41f61858d0a5647a1a7bfe089bf921be9",
);
const signature = BytesBlob.parseBlob(
  "0xf23e45d7f8977a8eda61513bd5cab1451eb64f265edf340c415f25480123391364521f9bb4c14f840a0dae20eb4dc4a735c961d9966da51dde0d85281dc1dc0b",
);

const data = new Array(1023);
data.fill({ key, message, signature });

const SPKI_PREFIX = new Uint8Array([
  0x30,
  0x2a, // SEQUENCE (42 bytes)
  0x30,
  0x05, // SEQUENCE (5 bytes)
  0x06,
  0x03, // OBJECT IDENTIFIER (3 bytes)
  0x2b,
  0x65,
  0x70, // Ed25519 OID: 1.3.101.112
  0x03,
  0x21, // BIT STRING (33 bytes: 1 padding + 32-byte key)
  0x00, // Zero padding before key
]);

function nativeVerify<T extends BytesBlob>(input: Input<T>[]): Promise<boolean[]> {
  return Promise.resolve(
    input.map(({ signature, message, key }) => {
      return crypto.verify(
        null,
        message.raw,
        createPublicKey({
          key: Buffer.concat([SPKI_PREFIX, key.raw]),
          format: "der",
          type: "spki",
        }),
        Buffer.from(signature.raw),
      );
    }),
  );
}

module.exports = () =>
  suite(
    "ED25519 signatures verification",

    /**
     * We also tried to use @noble/curves/ed25519 library to verify the signatures and it was the slowest option.
     */
    add("native crypto", async () => {
      const result = await nativeVerify(data);
      const isCorrect = result.every((x) => x);
      return isCorrect;
    }),

    add("wasm lib", async () => {
      const result = await ed25519.verify(data);
      const isCorrect = result.every((x) => x);
      return isCorrect;
    }),

    add("wasm lib batch", () => {
      const isCorrect = ed25519.verifyBatch(data);
      return isCorrect;
    }),

    cycle(),
    complete(),
    configure({}),
    ...save(import.meta.filename),
  );

if (require.main === module) {
  module.exports();
}
