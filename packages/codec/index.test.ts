import assert from "node:assert";
import { describe, it } from "node:test";
import { BytesBlob } from "@typeberry/bytes";
import { BitVec } from "@typeberry/bytes";
import type { U8, U16, U32, U64 } from "@typeberry/numbers";
import { Decoder } from "./decoder";
import { type Descriptor, codec } from "./descriptors";
import { Encoder } from "./encoder";

let seed = 1;
function random() {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

describe("JAM encoder / decoder", () => {
  type Generator<T> = {
    generate: () => T;
    descriptor: Descriptor<T>;
  };

  function generator<T>(generate: () => T, descriptor: Descriptor<T>) {
    return {
      generate,
      descriptor,
    };
  }

  // biome-ignore lint/suspicious/noExplicitAny: I need to make sure that the generator output matches the type.
  const types: Generator<any>[] = [
    generator(() => (BigInt(Math.floor(random() * 2 ** 32)) ** 2n) as U64, codec.varU64),
    generator(() => Math.floor(random() * 2 ** 32) as U32, codec.varU32),
    generator(() => (BigInt(Math.floor(random() * 2 ** 32)) ** 2n) as U64, codec.u64),
    generator(() => Math.floor(random() * 2 ** 32) as U32, codec.u32),
    generator(() => Math.floor(random() * 2 ** 24), codec.u24),
    generator(() => Math.floor(random() * 2 ** 16) as U16, codec.u16),
    generator(() => Math.floor(random() * 2 ** 8) as U8, codec.u8),
    generator(() => BigInt(Math.floor(random() * 2 ** 32)) ** 2n - 2n ** 63n, codec.i64),
    generator(() => Math.floor(random() * 2 ** 32) - 2 ** 31, codec.i32),
    generator(() => Math.floor(random() * 2 ** 24) - 2 ** 23, codec.i24),
    generator(() => Math.floor(random() * 2 ** 16) - 2 ** 15, codec.i16),
    generator(() => Math.floor(random() * 2 ** 8) - 2 ** 7, codec.i8),

    generator(() => {
      let len = Math.floor(random() * 10_000);
      const res = new Uint8Array(len);
      while (--len >= 0) {
        res[len] = Math.floor(random() * 256);
      }
      return BytesBlob.fromBlob(res);
    }, codec.blob),

    generator(() => {
      let len = Math.floor(random() * 10_000);
      const vec = BitVec.empty(len);
      while (--len >= 0) {
        vec.setBit(len, random() > 0.5);
      }
      return vec;
    }, codec.bitVecVarLen),

    generator(() => {
      let len = 10;
      const vec = BitVec.empty(len);
      while (--len >= 0) {
        vec.setBit(len, random() > 0.5);
      }
      return vec;
    }, codec.bitVecFixLen(10)),
  ];

  for (const g of types) {
    const max = 100;
    for (let i = 0; i < max; i += 1) {
      it(`should run random tests for ${g.descriptor.name} (${i + 1} / ${max})`, () => {
        const encoder = Encoder.create();
        const expected = g.generate();
        g.descriptor.encode(encoder, expected);
        const encoded = encoder.viewResult();

        const decoder = Decoder.fromBytesBlob(encoded);
        const result = g.descriptor.decode(decoder);
        decoder.finish();
        assert.deepStrictEqual(result, expected);
      });
    }
  }
});
