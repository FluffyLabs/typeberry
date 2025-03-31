import assert from "node:assert";
import { describe, it } from "node:test";
import { Registers } from "./registers";

const U32_BYTES = 4;

describe("Registers", () => {
  describe("loading values", () => {
    it("should return 0xff_ff_ff_ff correctly loaded into register", () => {
      const registers = Registers.empty();
      const expectedSignedNumber = -1;
      const expectedUnsignedNumber = 2 ** 32 - 1;

      registers.setU32(0, 0xff_ff_ff_ff);

      assert.strictEqual(registers.getI32(0), expectedSignedNumber);
      assert.strictEqual(registers.getU32(0), expectedUnsignedNumber);
    });

    it("should return 0x00_00_00_01 correctly loaded into register", () => {
      const registers = Registers.empty();
      const expectedSignedNumber = 1;
      const expectedUnsignedNumber = 1;

      registers.setU32(0, 0x00_00_00_01);

      assert.strictEqual(registers.getI32(0), expectedSignedNumber);
      assert.strictEqual(registers.getU32(0), expectedUnsignedNumber);
    });

    it("should return 0x80_00_00_00 correctly loaded into register", () => {
      const registers = Registers.empty();
      const expectedSignedNumber = -(2 ** 31);
      const expectedUnsignedNumber = 2 ** 31;

      registers.setU32(0, 0x80_00_00_00);

      assert.strictEqual(registers.getI32(0), expectedSignedNumber);
      assert.strictEqual(registers.getU32(0), expectedUnsignedNumber);
    });
  });

  describe("getBytesAsLittleEndian", () => {
    it("should return empty bytes array", () => {
      const regs = Registers.empty();

      const num = 0;
      const expectedBytes = new Uint8Array([0, 0, 0, 0]);

      regs.setU32(1, num);

      assert.deepStrictEqual(regs.getBytesAsLittleEndian(1, U32_BYTES), expectedBytes);
    });

    it("should return u8 number correctly encoded as little endian", () => {
      const regs = Registers.empty();

      const num = 0xff;
      const expectedBytes = new Uint8Array([0xff, 0, 0, 0]);

      regs.setU32(1, num);

      assert.deepStrictEqual(regs.getBytesAsLittleEndian(1, U32_BYTES), expectedBytes);
    });

    it("should return u16 number correctly encoded as little endian", () => {
      const regs = Registers.empty();

      const num = 0xff_ee;
      const expectedBytes = new Uint8Array([0xee, 0xff, 0, 0]);

      regs.setU32(1, num);

      assert.deepStrictEqual(regs.getBytesAsLittleEndian(1, U32_BYTES), expectedBytes);
    });

    it("should return u32 number correctly encoded as little endian", () => {
      const regs = Registers.empty();

      const num = 0xff_ee_dd_cc;
      const expectedBytes = new Uint8Array([0xcc, 0xdd, 0xee, 0xff]);

      regs.setU32(1, num);

      assert.deepStrictEqual(regs.getBytesAsLittleEndian(1, U32_BYTES), expectedBytes);
    });
  });
});
