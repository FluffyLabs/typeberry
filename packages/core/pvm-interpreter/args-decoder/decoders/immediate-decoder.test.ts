import { ImmediateDecoder } from "./immediate-decoder";

import assert from "node:assert";
import { describe, it } from "node:test";

describe("ImmediateDecoder", () => {
  describe("reading bytes as signed and unsigned number U32", () => {
    it("Positive number without elided octets", () => {
      const decoder = new ImmediateDecoder();
      const encodedBytes = new Uint8Array([0x01, 0x00, 0x00, 0x00]);
      const expectedSigned = 1;
      const expectedUnsigned = 1;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getSigned(), expectedSigned);
      assert.strictEqual(decoder.getUnsigned(), expectedUnsigned);
    });

    it("Negative number without elided octets", () => {
      const decoder = new ImmediateDecoder();
      const encodedBytes = new Uint8Array([0xff, 0xff, 0xff, 0xff]);
      const expectedSigned = -1;
      const expectedUnsigned = 2 ** 32 - 1;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getSigned(), expectedSigned);
      assert.strictEqual(decoder.getUnsigned(), expectedUnsigned);
    });

    it("Positive number with elided octets", () => {
      const decoder = new ImmediateDecoder();
      const encodedBytes = new Uint8Array([0x01]);
      const expectedSigned = 1;
      const expectedUnsigned = 1;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getSigned(), expectedSigned);
      assert.strictEqual(decoder.getUnsigned(), expectedUnsigned);
    });

    it("Negative number with elided octets", () => {
      const decoder = new ImmediateDecoder();
      const encodedBytes = new Uint8Array([0xff]);
      const expectedSigned = -1;
      const expectedUnsigned = 2 ** 32 - 1;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getSigned(), expectedSigned);
      assert.strictEqual(decoder.getUnsigned(), expectedUnsigned);
    });

    it("Large positive number without elided octets", () => {
      const decoder = new ImmediateDecoder();
      const encodedBytes = new Uint8Array([0xff, 0xff, 0x7f, 0x00]);
      const expectedSigned = 0x00_7f_ff_ff;
      const expectedUnsigned = 0x00_7f_ff_ff;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getSigned(), expectedSigned);
      assert.strictEqual(decoder.getUnsigned(), expectedUnsigned);
    });

    it("Large negative number without elided octets", () => {
      const decoder = new ImmediateDecoder();

      const encodedBytes = new Uint8Array([0x01, 0x00, 0x80, 0xff]);
      const expectedSigned = -0x00_7f_ff_ff;
      const expectedUnsigned = 0xff_80_00_01;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getSigned(), expectedSigned);
      assert.strictEqual(decoder.getUnsigned(), expectedUnsigned);
    });

    it("Maximum positive value", () => {
      const decoder = new ImmediateDecoder();

      const encodedBytes = new Uint8Array([0xff, 0xff, 0xff, 0x7f]);
      const expectedSigned = 0x7f_ff_ff_ff;
      const expectedUnsigned = 0x7f_ff_ff_ff;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getSigned(), expectedSigned);
      assert.strictEqual(decoder.getUnsigned(), expectedUnsigned);
    });

    it("Maximum negative value", () => {
      const decoder = new ImmediateDecoder();

      const encodedBytes = new Uint8Array([0x00, 0x00, 0x00, 0x80]);
      const expectedSigned = -(2 ** 31);
      const expectedUnsigned = 0x80_00_00_00;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getSigned(), expectedSigned);
      assert.strictEqual(decoder.getUnsigned(), expectedUnsigned);
    });

    it("Empty bytes array", () => {
      const decoder = new ImmediateDecoder();

      const encodedBytes = new Uint8Array([]);
      const expectedSigned = 0;
      const expectedUnsigned = 0;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getSigned(), expectedSigned);
      assert.strictEqual(decoder.getUnsigned(), expectedUnsigned);
    });
  });

  describe("reading bytes as signed and unsigned number U64", () => {
    it("Positive number without elided octets", () => {
      const decoder = new ImmediateDecoder();
      const encodedBytes = new Uint8Array([0x01, 0x00, 0x00, 0x00]);
      const expectedSigned = 1n;
      const expectedUnsigned = 1n;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getI64(), expectedSigned);
      assert.strictEqual(decoder.getU64(), expectedUnsigned);
    });

    it("Negative number without elided octets", () => {
      const decoder = new ImmediateDecoder();
      const encodedBytes = new Uint8Array([0xff, 0xff, 0xff, 0xff]);
      const expectedSigned = -1n;
      const expectedUnsigned = 2n ** 64n - 1n;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getI64(), expectedSigned);
      assert.strictEqual(decoder.getU64(), expectedUnsigned);
    });

    it("Positive number with elided octets", () => {
      const decoder = new ImmediateDecoder();
      const encodedBytes = new Uint8Array([0x01]);
      const expectedSigned = 1n;
      const expectedUnsigned = 1n;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getI64(), expectedSigned);
      assert.strictEqual(decoder.getU64(), expectedUnsigned);
    });

    it("Negative number with elided octets", () => {
      const decoder = new ImmediateDecoder();
      const encodedBytes = new Uint8Array([0xff]);
      const expectedSigned = -1n;
      const expectedUnsigned = 2n ** 64n - 1n;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getI64(), expectedSigned);
      assert.strictEqual(decoder.getU64(), expectedUnsigned);
    });

    it("Large positive number without elided octets", () => {
      const decoder = new ImmediateDecoder();
      const encodedBytes = new Uint8Array([0xff, 0xff, 0x7f, 0x00]);
      const expectedSigned = 0x00_7f_ff_ffn;
      const expectedUnsigned = 0x00_7f_ff_ffn;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getI64(), expectedSigned);
      assert.strictEqual(decoder.getU64(), expectedUnsigned);
    });

    it("Large negative number without elided octets", () => {
      const decoder = new ImmediateDecoder();

      const encodedBytes = new Uint8Array([0x01, 0x00, 0x80, 0xff]);
      const expectedSigned = -0x00_7f_ff_ffn;
      const expectedUnsigned = 0xff_ff_ff_ff_ff_80_00_01n;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getI64(), expectedSigned);
      assert.strictEqual(decoder.getU64(), expectedUnsigned);
    });

    it("Maximum positive value", () => {
      const decoder = new ImmediateDecoder();

      const encodedBytes = new Uint8Array([0xff, 0xff, 0xff, 0x7f]);
      const expectedSigned = 0x7f_ff_ff_ffn;
      const expectedUnsigned = 0x7f_ff_ff_ffn;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getI64(), expectedSigned);
      assert.strictEqual(decoder.getU64(), expectedUnsigned);
    });

    it("Maximum negative value", () => {
      const decoder = new ImmediateDecoder();

      const encodedBytes = new Uint8Array([0x00, 0x00, 0x00, 0x80]);
      const expectedSigned = -(2n ** 31n);
      const expectedUnsigned = 0xff_ff_ff_ff_80_00_00_00n;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getI64(), expectedSigned);
      assert.strictEqual(decoder.getU64(), expectedUnsigned);
    });

    it("Empty bytes array", () => {
      const decoder = new ImmediateDecoder();

      const encodedBytes = new Uint8Array([]);
      const expectedSigned = 0n;
      const expectedUnsigned = 0n;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getI64(), expectedSigned);
      assert.strictEqual(decoder.getU64(), expectedUnsigned);
    });
  });

  describe("getBytesAsLittleEndian", () => {
    it("should return empty bytes array", () => {
      const decoder = new ImmediateDecoder();

      const encodedBytes = new Uint8Array([]);
      const expectedBytes = new Uint8Array([0, 0, 0, 0]);

      decoder.setBytes(encodedBytes);

      assert.deepStrictEqual(decoder.getBytesAsLittleEndian(), expectedBytes);
    });

    it("should return u8 number correctly encoded as little endian", () => {
      const decoder = new ImmediateDecoder();

      const encodedBytes = new Uint8Array([0xff]);
      const expectedBytes = new Uint8Array([0xff, 0xff, 0xff, 0xff]);

      decoder.setBytes(encodedBytes);

      assert.deepStrictEqual(decoder.getBytesAsLittleEndian(), expectedBytes);
    });

    it("should return u16 number correctly encoded as little endian", () => {
      const decoder = new ImmediateDecoder();

      const encodedBytes = new Uint8Array([0xff, 0xee]);
      const expectedBytes = new Uint8Array([0xff, 0xee, 0xff, 0xff]);

      decoder.setBytes(encodedBytes);

      assert.deepStrictEqual(decoder.getBytesAsLittleEndian(), expectedBytes);
    });

    it("should return u32 number correctly encoded as little endian", () => {
      const decoder = new ImmediateDecoder();

      const encodedBytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);
      const expectedBytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);

      decoder.setBytes(encodedBytes);

      assert.deepStrictEqual(decoder.getBytesAsLittleEndian(), expectedBytes);
    });
  });

  describe("getExtendedBytesAsLittleEndian", () => {
    it("should return empty bytes array", () => {
      const decoder = new ImmediateDecoder();

      const encodedBytes = new Uint8Array([]);
      const expectedBytes = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);

      decoder.setBytes(encodedBytes);

      assert.deepStrictEqual(decoder.getExtendedBytesAsLittleEndian(), expectedBytes);
    });

    it("should return u8 number correctly encoded as little endian", () => {
      const decoder = new ImmediateDecoder();

      const encodedBytes = new Uint8Array([0xff]);
      const expectedBytes = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

      decoder.setBytes(encodedBytes);

      assert.deepStrictEqual(decoder.getExtendedBytesAsLittleEndian(), expectedBytes);
    });

    it("should return u16 number correctly encoded as little endian", () => {
      const decoder = new ImmediateDecoder();

      const encodedBytes = new Uint8Array([0xff, 0xee]);
      const expectedBytes = new Uint8Array([0xff, 0xee, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

      decoder.setBytes(encodedBytes);

      assert.deepStrictEqual(decoder.getExtendedBytesAsLittleEndian(), expectedBytes);
    });

    it("should return u32 number correctly encoded as little endian", () => {
      const decoder = new ImmediateDecoder();

      const encodedBytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);
      const expectedBytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc, 0xff, 0xff, 0xff, 0xff]);

      decoder.setBytes(encodedBytes);

      assert.deepStrictEqual(decoder.getExtendedBytesAsLittleEndian(), expectedBytes);
    });
  });
});
