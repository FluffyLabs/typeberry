import assert from "node:assert";
import { describe, it } from "node:test";

import { Bytes, BytesBlob } from "@typeberry/bytes";
import { BitVec } from "@typeberry/bytes";
import { Decoder } from "./decoder";

function decodeVarU32(source: Uint8Array) {
  const decoder = Decoder.fromBlob(source);
  const value = decoder.varU32();
  const bytesToSkip = decoder.bytesRead();

  // compare with u64 just to be sure.
  const decoder2 = Decoder.fromBlob(source);
  assert.strictEqual(decoder2.varU64(), BigInt(value));

  return { value, bytesToSkip };
}

function decodeVarU64(source: Uint8Array) {
  const decoder = Decoder.fromBlob(source);
  const value = decoder.varU64();
  const bytesToSkip = decoder.bytesRead();
  return { value, bytesToSkip };
}

describe("decode natural number", () => {
  it("decode 0", () => {
    const encodedBytes = new Uint8Array([0]);
    const expectedValue = 0;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode single byte min value", () => {
    const encodedBytes = new Uint8Array([1]);
    const expectedValue = 1;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode single byte max value", () => {
    const encodedBytes = new Uint8Array([127]);
    const expectedValue = 127;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 2 bytes min value", () => {
    const encodedBytes = new Uint8Array([128, 128]);
    const expectedValue = 128;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 2 bytes max value", () => {
    const encodedBytes = new Uint8Array([191, 255]);
    const expectedValue = 2 ** 14 - 1;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 3 bytes min value", () => {
    const encodedBytes = new Uint8Array([192, 0, 0x40]);
    const expectedValue = 2 ** 14;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 3 bytes max value", () => {
    const encodedBytes = new Uint8Array([192 + 31, 0xff, 0xff]);
    const expectedValue = 2 ** 21 - 1;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 4 bytes min value", () => {
    const encodedBytes = new Uint8Array([0xe0, 0, 0, 0x20]);
    const expectedValue = 2 ** 21;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 4 bytes max value", () => {
    const encodedBytes = new Uint8Array([0xe0 + 15, 0xff, 0xff, 0xff]);
    const expectedValue = 2 ** 28 - 1;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 5 bytes min value", () => {
    const encodedBytes = new Uint8Array([256 - 16, 0, 0, 0, 0x10]);
    const expectedValue = 2n ** 28n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 5 bytes max value", () => {
    const encodedBytes = new Uint8Array([256 - 16 + 7, 0xff, 0xff, 0xff, 0xff]);
    const expectedValue = 2n ** 35n - 1n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 6 bytes min value", () => {
    const encodedBytes = new Uint8Array([256 - 8, 0, 0, 0, 0, 0x08]);
    const expectedValue = 2n ** 35n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 6 bytes max value", () => {
    const encodedBytes = new Uint8Array([256 - 8 + 3, 0xff, 0xff, 0xff, 0xff, 0xff]);
    const expectedValue = 2n ** 42n - 1n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 7 bytes min value", () => {
    const encodedBytes = new Uint8Array([256 - 4, 0, 0, 0, 0, 0, 0x04]);
    const expectedValue = 2n ** 42n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 7 bytes max value", () => {
    const encodedBytes = new Uint8Array([256 - 4 + 1, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    const expectedValue = 2n ** 49n - 1n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 8 bytes min value", () => {
    const encodedBytes = new Uint8Array([256 - 2, 0, 0, 0, 0, 0, 0, 0x02]);
    const expectedValue = 2n ** 49n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 8 bytes max value", () => {
    const encodedBytes = new Uint8Array([256 - 2, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    const expectedValue = 2n ** 56n - 1n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 9 bytes min value", () => {
    const encodedBytes = new Uint8Array([255, 0, 0, 0, 0, 0, 0, 0, 0x01]);
    const expectedValue = 2n ** 56n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 9 bytes max value", () => {
    const encodedBytes = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255]);
    const expectedValue = 2n ** 64n - 1n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, encodedBytes.length);
  });

  it("decode 0 with extra bytes", () => {
    const encodedBytes = new Uint8Array([0, 1, 2, 3]);
    const expectedValue = 0;

    const result = decodeVarU32(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, 1);
  });

  it("decode 7 bytes number with extra bytes ", () => {
    const encodedBytes = new Uint8Array([256 - 4 + 1, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x1, 0x2]);
    const expectedValue = 2n ** 49n - 1n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, 7);
  });

  it("decode 9 bytes number with extra bytes", () => {
    const encodedBytes = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255, 1, 2, 3]);
    const expectedValue = 2n ** 64n - 1n;

    const result = decodeVarU64(encodedBytes);

    assert.strictEqual(result.value, expectedValue);
    assert.strictEqual(result.bytesToSkip, 9);
  });
});

describe("JAM decoder / bytes", () => {
  it("should decode empty bytes sequence", () => {
    const input = BytesBlob.parseBlob("0x00");
    const decoder = Decoder.fromBytesBlob(input);

    const blob = decoder.bytesBlob();

    assert.deepStrictEqual(blob.toString(), "0x");
  });

  it("should decode bytes sequence", () => {
    const input = BytesBlob.parseBlob("0x04deadbeef");
    const decoder = Decoder.fromBytesBlob(input);

    const blob = decoder.bytesBlob();

    assert.deepStrictEqual(blob.toString(), "0xdeadbeef");
  });

  it("should decode a fixed-length bytes", () => {
    const input = BytesBlob.parseBlob("0xdeadbeef");
    const decoder = Decoder.fromBytesBlob(input);

    const blob = decoder.bytes(4);

    assert.deepStrictEqual(blob.toString(), "0xdeadbeef");
  });
});

describe("JAM decoder / numbers", () => {
  it("should decode a large number", () => {
    const input = BytesBlob.parseBlob("0xf0ffffffff");
    const decoder = Decoder.fromBytesBlob(input);

    const l = decoder.varU32();
    decoder.moveTo(0);
    const ln = decoder.varU64();

    assert.deepStrictEqual(BigInt(l), ln);
    assert.deepStrictEqual(l, 2 ** 32 - 1);
  });

  it("should fail to decode a number over 32-bits", () => {
    const input = BytesBlob.parseBlob("0xf100000000");
    const decoder = Decoder.fromBytesBlob(input);

    const ln = decoder.varU64();
    assert.deepStrictEqual(ln, 2n ** 32n);

    decoder.moveTo(0);
    assert.throws(() => decoder.varU32(), {
      name: "Error",
      message: "Unexpectedly large value for u32. l=4, firstByte=1",
    });
  });

  it("should decode variable length u32", () => {
    const input = BytesBlob.parseBlob("0x000102032af0fffffffff0ffffff7ff042424242");
    const decoder = Decoder.fromBytesBlob(input);

    assert.deepStrictEqual(decoder.varU32(), 0);
    assert.deepStrictEqual(decoder.varU32(), 1);
    assert.deepStrictEqual(decoder.varU32(), 2);
    assert.deepStrictEqual(decoder.varU32(), 3);
    assert.deepStrictEqual(decoder.varU32(), 42);
    assert.deepStrictEqual(decoder.varU32(), 2 ** 32 - 1);
    assert.deepStrictEqual(decoder.varU32(), 2 ** 31 - 1);
    assert.deepStrictEqual(decoder.varU32(), 0x42424242);
  });

  it("should decode variable length u64", () => {
    const input = BytesBlob.parseBlob("0x0001f100000000ff0000000000000001ffffffffffffffffff");
    const decoder = Decoder.fromBytesBlob(input);

    assert.deepStrictEqual(decoder.varU64(), 0n);
    assert.deepStrictEqual(decoder.varU64(), 1n);
    assert.deepStrictEqual(decoder.varU64(), 2n ** 32n);
    assert.deepStrictEqual(decoder.varU64(), 2n ** 56n);
    assert.deepStrictEqual(decoder.varU64(), 2n ** 64n - 1n);
  });

  it("should decode a bunch of i32 numbers", () => {
    const input = BytesBlob.parseBlob("0xffffff7f0000008042424242d6ffffff00000000");
    const decoder = Decoder.fromBytesBlob(input);

    const results = [decoder.i32(), decoder.i32(), decoder.i32(), decoder.i32(), decoder.i32()];

    assert.deepStrictEqual(results, [2 ** 31 - 1, -(2 ** 31), 0x42424242, -42, 0]);
  });

  it("should decode a bunch of u32 numbers", () => {
    const input = BytesBlob.parseBlob("0xffffff7f0000008042424242d6ffffff00000000");
    const decoder = Decoder.fromBytesBlob(input);

    const results = [decoder.u32(), decoder.u32(), decoder.u32(), decoder.u32(), decoder.u32()];

    assert.deepStrictEqual(results, [2 ** 31 - 1, 2 ** 32 - 2 ** 31, 0x42424242, 2 ** 32 - 42, 0]);
  });

  it("should decode a bunch of i24 numbers", () => {
    const input = BytesBlob.parseBlob("0x424242d6ffff00000081ffff811c15000080ffff7f010080");
    const decoder = Decoder.fromBytesBlob(input);

    assert.deepStrictEqual(decoder.i24(), 0x424242);
    assert.deepStrictEqual(decoder.i24(), -42);
    assert.deepStrictEqual(decoder.i24(), 0);
    assert.deepStrictEqual(decoder.i24(), -127);
    assert.deepStrictEqual(decoder.i24(), 1383553);
    assert.deepStrictEqual(decoder.i24(), -(2 ** 23));
    assert.deepStrictEqual(decoder.i24(), 2 ** 23 - 1);
    assert.deepStrictEqual(decoder.i24(), -(2 ** 23 - 1));
  });

  it("should decode a bunch of i16 numbers", () => {
    const input = BytesBlob.parseBlob("0x4242d6ff0000");
    const decoder = Decoder.fromBytesBlob(input);

    const results = [decoder.i16(), decoder.i16(), decoder.i16()];

    assert.deepStrictEqual(results, [0x4242, -42, 0]);
  });

  it("should decode a bunch of i8 numbers", () => {
    const input = BytesBlob.parseBlob("0x42d600");
    const decoder = Decoder.fromBytesBlob(input);

    const results = [decoder.i8(), decoder.i8(), decoder.i8()];

    assert.deepStrictEqual(results, [0x42, -42, 0]);
  });

  it("should decode a bool", () => {
    const input = BytesBlob.parseBlob("0x0100");
    const decoder = Decoder.fromBytesBlob(input);

    assert.deepStrictEqual(decoder.bool(), true);
    assert.deepStrictEqual(decoder.bool(), false);
  });
});

describe("JAM decoder / bitvec", () => {
  it("should decode a 1-byte bit vector", () => {
    const input = BytesBlob.parseBlob("0x410841");
    const decoder = Decoder.fromBytesBlob(input);

    // when
    const bitvec1 = decoder.bitVecFixLen(8);
    const bitvec2 = decoder.bitVecVarLen();

    // then
    const expected = BitVec.empty(8);
    expected.setBit(0, true);
    expected.setBit(6, true);

    assert.deepStrictEqual(bitvec1, expected);
    assert.deepStrictEqual(bitvec2, expected);
  });

  it("should decode a longer bit vector", () => {
    const input = BytesBlob.parseBlob("0x01000000010000800141010000000100008001");
    const decoder = Decoder.fromBytesBlob(input);

    // when
    const bitvec1 = decoder.bitVecFixLen(65);
    const bitvec2 = decoder.bitVecVarLen();

    // then
    const expected = BitVec.empty(65);
    expected.setBit(0, true);
    expected.setBit(32, true);
    expected.setBit(63, true);
    expected.setBit(64, true);

    assert.deepStrictEqual(bitvec1, expected);
    assert.deepStrictEqual(bitvec2, expected);
  });

  it("should fail if remaining bits are set", () => {
    const input = BytesBlob.parseBlob("0x010000000100008011");
    const decoder = Decoder.fromBytesBlob(input);

    // when
    assert.throws(() => decoder.bitVecFixLen(65), {
      name: "Error",
      message: "Non-zero bits found in the last byte of bitvec encoding.",
    });
  });
});

describe("JAM decoder / generics", () => {
  class MyType {
    constructor(
      public x: number,
      public y: boolean,
      public z: Bytes<4>,
    ) {}

    static decode(decoder: Decoder): MyType {
      const x = decoder.i32();
      const y = decoder.bool();
      const z = decoder.bytes(4);

      return new MyType(x, y, z);
    }
  }

  it("should decode an optional value", () => {
    const input = BytesBlob.parseBlob("0x010300000001deadbeef0000010500000000deadbeef");
    const decoder = Decoder.fromBytesBlob(input);

    const results = [
      decoder.optional(MyType),
      decoder.optional(MyType),
      decoder.optional(MyType),
      decoder.optional(MyType),
    ];

    assert.deepStrictEqual(results, [
      new MyType(3, true, Bytes.parseBytes("0xdeadbeef", 4)),
      null,
      null,
      new MyType(5, false, Bytes.parseBytes("0xdeadbeef", 4)),
    ]);
  });

  it("should decode a sequence", () => {
    const input = BytesBlob.parseBlob(
      "0x030500000001deadbeef0700000001deadbeef0a00000001deadbeef0500000001deadbeef0700000001deadbeef0a00000001deadbeef",
    );
    const decoder = Decoder.fromBytesBlob(input);

    const result1 = decoder.sequenceVarLen(MyType);
    const result2 = decoder.sequenceFixLen(MyType, 3);

    const bytes = Bytes.parseBytes("0xdeadbeef", 4);
    const expected = [new MyType(5, true, bytes), new MyType(7, true, bytes), new MyType(10, true, bytes)];

    assert.deepStrictEqual(result1, expected);
    assert.deepStrictEqual(result2, expected);
  });
});
