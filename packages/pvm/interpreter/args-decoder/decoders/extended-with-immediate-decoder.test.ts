import assert from "node:assert";
import { describe, it } from "node:test";

import { ExtendedWitdthImmediateDecoder } from './extended-with-immediate-decoder';

describe("ExtendedWitdthImmediateDecoder", () => {
  describe("reading bytes as unsigned number", () => {
    it("8-bytes number", () => {
      const decoder = new ExtendedWitdthImmediateDecoder();
      const encodedBytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa, 0x99, 0x88]);
      const expectedValue = 0x88_99_aa_bb_cc_dd_ee_ffn;

      decoder.setBytes(encodedBytes);

      assert.strictEqual(decoder.getValue(), expectedValue);
    });
  });

  describe("read immediate as bytes (little endian)", () => {
      it("8-bytes number", () => {
        const decoder = new ExtendedWitdthImmediateDecoder();
        const encodedBytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa, 0x99, 0x88]);
        const expectedBytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa, 0x99, 0x88]);

        decoder.setBytes(encodedBytes);
  
        assert.deepStrictEqual(decoder.getBytesAsLittleEndian(), expectedBytes);
      });
  });
});
