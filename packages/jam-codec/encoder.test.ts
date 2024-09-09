import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes, BytesBlob } from "@typeberry/bytes";
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
  it("should encode variable length u32", () => {
    const encoder = Encoder.create();

    encoder.u32(0);
    encoder.u32(1);
    encoder.u32(2);
    encoder.u32(3);
    encoder.u32(42);
    encoder.u32(2 ** 32 - 1);
    encoder.u32(2 ** 31 - 1);
    encoder.u32(0x42424242);

    assert.deepStrictEqual(encoder.viewResult(), BytesBlob.parseBlob("0x000102032af7ffffff1ff3ffffff1ff242424202"));
  });

  it("should encode a bunch of i32 numbers", () => {
    const encoder = Encoder.create();

    encoder.i32(2 ** 31 - 1);
    encoder.i32(-(2 ** 31));
    encoder.i32(0x42424242);
    encoder.i32(-42);
    encoder.i32(0);

    assert.deepStrictEqual(encoder.viewResult(), BytesBlob.parseBlob("0xffffff7f01000080424242422b00000000000000"));
  });

  it("should encode a bunch of i24 numbers", () => {
    const encoder = Encoder.create();

    encoder.i24(0x424242);
    encoder.i24(-42);
    encoder.i24(0);

    assert.deepStrictEqual(encoder.viewResult(), BytesBlob.parseBlob("0x4242422b0000000000"));
  });

  it("should encode a bunch of i16 numbers", () => {
    const encoder = Encoder.create();

    encoder.i16(0x4242);
    encoder.i16(-42);
    encoder.i16(0);

    assert.deepStrictEqual(encoder.viewResult(), BytesBlob.parseBlob("0x42422b000000"));
  });

  it("should encode a bunch of i8 numbers", () => {
    const encoder = Encoder.create();

    encoder.i8(0x42);
    encoder.i8(-42);
    encoder.i8(0);

    assert.deepStrictEqual(encoder.viewResult(), BytesBlob.parseBlob("0x422b00"));
  });
});

// TODO [ToDr] check the negative space (exceptions).
