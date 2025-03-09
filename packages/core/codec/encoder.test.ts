import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { BitVec } from "@typeberry/bytes";
import type { U32 } from "@typeberry/numbers";
import { Encoder } from "./encoder";

describe("JAM encoder / bytes", () => {
  it("should encode empty bytes sequence", () => {
    const blob = BytesBlob.parseBlob("0x");
    const encoder = Encoder.create();

    encoder.bytesBlob(blob);

    assert.deepStrictEqual(
      encoder.viewResult(),
      // we have the length prefix.
      BytesBlob.parseBlob("0x00"),
    );
  });

  it("should encode bytes sequence", () => {
    const blob = BytesBlob.parseBlob("0xdeadbeef");
    const encoder = Encoder.create();

    encoder.bytesBlob(blob);

    assert.deepStrictEqual(encoder.viewResult(), BytesBlob.parseBlob("0x04deadbeef"));
  });

  it("should encode a fixed-length bytes", () => {
    const bytes = Bytes.parseBytes("0xdeadbeef", 4);
    const encoder = Encoder.create();

    encoder.bytes(bytes);

    assert.deepStrictEqual(encoder.viewResult(), BytesBlob.parseBlob("0xdeadbeef"));
  });
});

describe("JAM encoder / numbers", () => {
  it("should encode a large 32-bit number", () => {
    const encoder = Encoder.create();

    encoder.varU32((2 ** 32 - 1) as U32);

    assert.deepStrictEqual(encoder.viewResult().toString(), "0xf0ffffffff");
  });

  it("should encode variable length u32", () => {
    const encoder = Encoder.create();

    encoder.varU32(0 as U32);
    encoder.varU32(1 as U32);
    encoder.varU32(2 as U32);
    encoder.varU32(3 as U32);
    encoder.varU32(42 as U32);
    encoder.varU32((2 ** 32 - 1) as U32);
    encoder.varU32((2 ** 31 - 1) as U32);
    encoder.varU32(0x42424242 as U32);

    assert.deepStrictEqual(encoder.viewResult().toString(), "0x000102032af0fffffffff0ffffff7ff042424242");
  });

  it("should encode variable length u64", () => {
    const encoder = Encoder.create();

    encoder.varU64(0n);
    encoder.varU64(1n);
    encoder.varU64(2n ** 32n);
    encoder.varU64(2n ** 56n);
    encoder.varU64(2n ** 64n - 1n);

    assert.deepStrictEqual(encoder.viewResult().toString(), "0x0001f100000000ff0000000000000001ffffffffffffffffff");
  });

  it("should encode a bunch of i64 numbers", () => {
    const encoder = Encoder.create();

    encoder.i64(2n ** 63n - 1n);
    encoder.i64(-(2n ** 63n));
    encoder.i64(0x42424242n);
    encoder.i64(-42n);
    encoder.i64(0n);

    assert.deepStrictEqual(
      encoder.viewResult().toString(),
      BytesBlob.parseBlob(
        "0xffffffffffffff7f00000000000000804242424200000000d6ffffffffffffff0000000000000000",
      ).toString(),
    );
  });

  it("should encode a bunch of i32 numbers", () => {
    const encoder = Encoder.create();

    encoder.i32(2 ** 31 - 1);
    encoder.i32(-(2 ** 31));
    encoder.i32(0x42424242);
    encoder.i32(-42);
    encoder.i32(0);

    assert.deepStrictEqual(
      encoder.viewResult().toString(),
      BytesBlob.parseBlob("0xffffff7f0000008042424242d6ffffff00000000").toString(),
    );
  });

  it("should encode a bunch of i24 numbers", () => {
    const encoder = Encoder.create();

    encoder.i24(0x424242);
    encoder.i24(-42);
    encoder.i24(0);
    encoder.i24(-127);
    encoder.i24(1383553);
    encoder.i24(2 ** 23);
    encoder.i24(2 ** 23 - 1);
    encoder.i24(2 ** 23 + 1);

    assert.deepStrictEqual(
      encoder.viewResult().toString(),
      BytesBlob.parseBlob("0x424242d6ffff00000081ffff811c15000080ffff7f010080").toString(),
    );
  });

  it("should encode a bunch of i16 numbers", () => {
    const encoder = Encoder.create();

    encoder.i16(0x4242);
    encoder.i16(-42);
    encoder.i16(0);

    assert.deepStrictEqual(encoder.viewResult().toString(), BytesBlob.parseBlob("0x4242d6ff0000").toString());
  });

  it("should encode a bunch of i8 numbers", () => {
    const encoder = Encoder.create();

    encoder.i8(0x42);
    encoder.i8(-42);
    encoder.i8(0);

    assert.deepStrictEqual(encoder.viewResult(), BytesBlob.parseBlob("0x42d600"));
  });

  it("should encode a bool", () => {
    const encoder = Encoder.create();

    encoder.bool(true);
    encoder.bool(false);

    assert.deepStrictEqual(encoder.viewResult(), BytesBlob.parseBlob("0x0100"));
  });
});

describe("JAM encoder / sizing", () => {
  it("should throw exception if destination is too small", () => {
    const encoder = Encoder.create({
      destination: new Uint8Array(2),
    });

    assert.throws(
      () => {
        encoder.i32(5);
      },
      {
        name: "Error",
        message: "Not enough space in the destination array. Needs 4, has 2.",
      },
    );
  });

  it("should extend the space", () => {
    const encoder = Encoder.create({
      expectedLength: 1,
    });

    encoder.i32(5);

    assert.deepStrictEqual(encoder.viewResult(), BytesBlob.parseBlob("0x05000000"));
  });
});

describe("JAM encoder / bitvec", () => {
  it("should encode a 1-byte bit vector", () => {
    const encoder = Encoder.create();
    // 1 byte long bit vec
    const bitvec = BitVec.empty(8);
    bitvec.setBit(0, true);
    bitvec.setBit(6, true);

    // when
    encoder.bitVecFixLen(bitvec);
    encoder.bitVecVarLen(bitvec);

    assert.deepStrictEqual(encoder.viewResult().toString(), "0x410841");
  });

  it("should encode a longer bit vector", () => {
    const encoder = Encoder.create();
    const bitvec = BitVec.empty(65);
    bitvec.setBit(0, true);
    bitvec.setBit(32, true);
    bitvec.setBit(63, true);
    bitvec.setBit(64, true);

    // when
    encoder.bitVecFixLen(bitvec);
    encoder.bitVecVarLen(bitvec);

    assert.deepStrictEqual(encoder.viewResult().toString(), "0x01000000010000800141010000000100008001");
  });
});

describe("JAM encoder / generics", () => {
  class MyType {
    z: Bytes<4>;
    constructor(
      public x: number,
      public y: boolean,
      z?: Bytes<4>,
    ) {
      this.z = z ?? Bytes.parseBytes("0xdeadbeef", 4);
    }

    static encode(encoder: Encoder, elem: MyType) {
      encoder.i32(elem.x);
      encoder.bool(elem.y);
      encoder.bytes(elem.z);
    }

    static sizeHint = { bytes: 4 + 1 + 4, isExact: true };
  }

  it("should encode an optional value", () => {
    const encoder = Encoder.create();

    encoder.optional(MyType, new MyType(3, true));
    encoder.optional(MyType, null);
    encoder.optional(MyType, null);
    encoder.optional(MyType, new MyType(5, false));

    assert.deepStrictEqual(encoder.viewResult().toString(), "0x010300000001deadbeef0000010500000000deadbeef");
  });

  it("should encode a sequence", () => {
    const encoder = Encoder.create();
    const seq = [new MyType(5, true), new MyType(7, true), new MyType(10, true)];

    encoder.sequenceVarLen(MyType, seq);
    encoder.sequenceFixLen(MyType, seq);

    assert.deepStrictEqual(
      encoder.viewResult().toString(),
      "0x030500000001deadbeef0700000001deadbeef0a00000001deadbeef0500000001deadbeef0700000001deadbeef0a00000001deadbeef",
    );
  });
});
