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

    assert.deepStrictEqual(encoder.viewResult().toString(), BytesBlob.parseBlob("0x424242d6ffff000000").toString());
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
// TODO [ToDr] check the negative space (exceptions).
