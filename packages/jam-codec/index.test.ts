import assert from "node:assert";
import { describe, it } from "node:test";
import { BytesBlob } from "@typeberry/bytes";
import { BitVec } from "@typeberry/bytes";
import { Decoder } from "./decoder";
import { Encoder } from "./encoder";

let seed = 1;
function random() {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

describe("JAM encoder / decoder", () => {
  type Generator<T> = {
    generate: () => T;
    type: ReturnType<typeof type<T>>;
  };

  function generator<T>(generate: () => T, ty: ReturnType<typeof type<T>>) {
    return {
      generate,
      type: ty,
    };
  }

  function type<T>(name: string, encode: (e: Encoder, elem: T) => void, decode: (d: Decoder) => T) {
    return {
      name,
      encode,
      decode,
    };
  }

  const VAR_U32 = type<number>(
    "var_u32",
    (e, v) => e.varU32(v),
    (d) => d.varU32(),
  );
  const VAR_U64 = type<bigint>(
    "var_u64",
    (e, v) => e.varU64(v),
    (d) => d.varU64(),
  );

  const U32 = type<number>(
    "u32",
    (e, v) => e.i32(v),
    (d) => d.u32(),
  );
  const U24 = type<number>(
    "u24",
    (e, v) => e.i24(v),
    (d) => d.u24(),
  );
  const U16 = type<number>(
    "u16",
    (e, v) => e.i16(v),
    (d) => d.u16(),
  );
  const U8 = type<number>(
    "u8",
    (e, v) => e.i8(v),
    (d) => d.u8(),
  );

  const I32 = type<number>(
    "i32",
    (e, v) => e.i32(v),
    (d) => d.i32(),
  );
  const I24 = type<number>(
    "i24",
    (e, v) => e.i24(v),
    (d) => d.i24(),
  );
  const I16 = type<number>(
    "i16",
    (e, v) => e.i16(v),
    (d) => d.i16(),
  );
  const I8 = type<number>(
    "i8",
    (e, v) => e.i8(v),
    (d) => d.i8(),
  );

  const BLOB = type<BytesBlob>(
    "BytesBlob",
    (e, v) => e.bytesBlob(v),
    (d) => d.bytesBlob(),
  );
  const BITVEC = type<BitVec>(
    "BitVec",
    (e, v) => e.bitVecVarLen(v),
    (d) => d.bitVecVarLen(),
  );

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
      it(`should run random tests for ${g.type.name} (${i + 1} / ${max})`, () => {
        const encoder = Encoder.create();
        const expected = g.generate();
        g.type.encode(encoder, expected);
        const encoded = encoder.viewResult();

        const decoder = Decoder.fromBytesBlob(encoded);
        const result = g.type.decode(decoder);
        decoder.finish();
        assert.deepStrictEqual(result, expected);
      });
    }
  }
});
