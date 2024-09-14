import assert from "node:assert";
import { describe, it } from "node:test";
import { BytesBlob } from "@typeberry/bytes";
import { BitVec } from "@typeberry/bytes";
import { Decoder } from "./decoder";
import { Encoder } from "./encoder";
import {BITVEC, BLOB, Descriptor, I16, I24, I32, I8, U16, U24, U32, U8, VAR_U32, VAR_U64} from "./descriptors";

let seed = 1;
function random() {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

describe("JAM encoder / decoder", () => {
  type Generator<T> = {
    generate: () => T;
    descriptor: Descriptor<T>,
  };

  function generator<T>(generate: () => T, descriptor: Descriptor<T>) {
    return {
      generate,
      descriptor,
    };
  }

  // biome-ignore lint/suspicious/noExplicitAny: I need to make sure that the generator output matches the type.
  const types: Generator<any>[] = [
    generator(() => BigInt(Math.floor(random() * 2 ** 32)) ** 2n, VAR_U64),
    generator(() => Math.floor(random() * 2 ** 32), VAR_U32),
    generator(() => Math.floor(random() * 2 ** 32), U32),
    generator(() => Math.floor(random() * 2 ** 24), U24),
    generator(() => Math.floor(random() * 2 ** 16), U16),
    generator(() => Math.floor(random() * 2 ** 8), U8),
    generator(() => Math.floor(random() * 2 ** 32) - 2 ** 31, I32),
    generator(() => Math.floor(random() * 2 ** 24) - 2 ** 23, I24),
    generator(() => Math.floor(random() * 2 ** 16) - 2 ** 15, I16),
    generator(() => Math.floor(random() * 2 ** 8) - 2 ** 7, I8),

    generator(() => {
      let len = Math.floor(random() * 10_000);
      const res = new Uint8Array(len);
      while (--len >= 0) {
        res[len] = Math.floor(random() * 256);
      }
      return BytesBlob.fromBlob(res);
    }, BLOB),

    generator(() => {
      let len = Math.floor(random() * 10_000);
      const vec = BitVec.empty(len);
      while (--len >= 0) {
        vec.setBit(len, random() > 0.5);
      }
      return vec;
    }, BITVEC),
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
        assert.deepStrictEqual(result, expected);
      });
    }
  }
});
