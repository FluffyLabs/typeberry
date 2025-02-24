import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup";
import { BytesBlob } from "@typeberry/bytes";
import { ed25519 } from "@typeberry/crypto";

const key = BytesBlob.parseBlob("0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29");
const message = BytesBlob.parseBlob(
  "0x6a616d5f67756172616e74656511da6d1f761ddf9bdb4c9d6e5303ebd41f61858d0a5647a1a7bfe089bf921be9",
);
const signature = BytesBlob.parseBlob(
  "0xf23e45d7f8977a8eda61513bd5cab1451eb64f265edf340c415f25480123391364521f9bb4c14f840a0dae20eb4dc4a735c961d9966da51dde0d85281dc1dc0b",
);

const data = new Array(1023);
data.fill({ key, message, signature });

module.exports = () =>
  suite(
    "ED25519 signatures verification",

    add("native crypto", async () => {
      const result = await ed25519.nativeVerify(data);
      const isCorrect = result.every((x) => x);
      return isCorrect;
    }),

    add("nodejs lib", async () => {
      const result = await ed25519.verify(data);
      const isCorrect = result.every((x) => x);
      return isCorrect;
    }),

    add("wasm lib", async () => {
      const result = await ed25519.verifyWasm(data);
      const isCorrect = result.every((x) => x);
      return isCorrect;
    }),

    add("wasm lib batch", () => {
      const isCorrect = ed25519.verifyWasmBatch(data);
      return isCorrect;
    }),

    cycle(),
    complete(),
    configure({}),
    ...save(__filename),
  );

if (require.main === module) {
  module.exports();
}
