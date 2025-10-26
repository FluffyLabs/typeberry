import assert from "node:assert";
import { describe, it } from "node:test";
import { Registers } from "./registers.js";

const U32_BYTES = 4;
const U64_BYTES = 8;

describe("Registers", () => {
  describe("loading values", () => {
    it("should return 0xff_ff_ff_ff correctly loaded into register", () => {
      const registers = new Registers();
      const expectedSignedNumber = -1;
      const expectedUnsignedNumber = 2 ** 32 - 1;

      registers.setU32(0, 0xff_ff_ff_ff);

      assert.strictEqual(registers.getLowerI32(0), expectedSignedNumber);
      assert.strictEqual(registers.getLowerU32(0), expectedUnsignedNumber);
    });

    it("should return 0x00_00_00_01 correctly loaded into register", () => {
      const registers = new Registers();
      const expectedSignedNumber = 1;
      const expectedUnsignedNumber = 1;

      registers.setU32(0, 0x00_00_00_01);

      assert.strictEqual(registers.getLowerI32(0), expectedSignedNumber);
      assert.strictEqual(registers.getLowerU32(0), expectedUnsignedNumber);
    });

    it("should return 0x80_00_00_00 correctly loaded into register", () => {
      const registers = new Registers();
      const expectedSignedNumber = -(2 ** 31);
      const expectedUnsignedNumber = 2 ** 31;

      registers.setU32(0, 0x80_00_00_00);

      assert.strictEqual(registers.getLowerI32(0), expectedSignedNumber);
      assert.strictEqual(registers.getLowerU32(0), expectedUnsignedNumber);
    });
  });

  describe("getBytesAsLittleEndian", () => {
    it("should return empty bytes array", () => {
      const regs = new Registers();

      const num = 0;
      const expectedBytes = new Uint8Array([0, 0, 0, 0]);

      regs.setU32(1, num);

      assert.deepStrictEqual(regs.getBytesAsLittleEndian(1, U32_BYTES), expectedBytes);
    });

    it("should return u8 number correctly encoded as little endian", () => {
      const regs = new Registers();

      const num = 0xff;
      const expectedBytes = new Uint8Array([0xff, 0, 0, 0]);

      regs.setU32(1, num);

      assert.deepStrictEqual(regs.getBytesAsLittleEndian(1, U32_BYTES), expectedBytes);
    });

    it("should return u16 number correctly encoded as little endian", () => {
      const regs = new Registers();

      const num = 0xff_ee;
      const expectedBytes = new Uint8Array([0xee, 0xff, 0, 0]);

      regs.setU32(1, num);

      assert.deepStrictEqual(regs.getBytesAsLittleEndian(1, U32_BYTES), expectedBytes);
    });

    it("should return u32 number correctly encoded as little endian", () => {
      const regs = new Registers();

      const num = 0xff_ee_dd_cc;
      const expectedBytes = new Uint8Array([0xcc, 0xdd, 0xee, 0xff]);

      regs.setU32(1, num);

      assert.deepStrictEqual(regs.getBytesAsLittleEndian(1, U32_BYTES), expectedBytes);
    });
  });

  describe("Implemented IRegister", () => {
    it("should correctly get all registers into bytes encoded", () => {
      const regs = new Registers();

      const num = 0xef_cd_ab_89_67_45_23_01n;
      const bytesReg = new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef]);
      const fill = new Uint8Array(12 * U64_BYTES).fill(0); // we set 1st register so we fill remaining 12 with 0
      const expected = new Uint8Array([...bytesReg, ...fill]);

      regs.setU64(0, num);

      // when
      const encodedAllRegisters = regs.getAllEncoded();

      // then
      assert.deepStrictEqual(encodedAllRegisters.length, expected.length);
      assert.deepStrictEqual(encodedAllRegisters, expected);
    });

    it("should correctly set all registers from bytes encoded", () => {
      const regs = new Registers();

      const bytesReg = new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef]);
      const fill = new Uint8Array(12 * U64_BYTES).fill(0); // we set 1st register so we fill remaining 12 with 0
      const bytes = new Uint8Array([...bytesReg, ...fill]);

      const expected = 0xef_cd_ab_89_67_45_23_01n;

      regs.setAllEncoded(bytes);

      const reg = regs.getU64(0);

      assert.deepStrictEqual(reg, expected);
    });

    it("should throw when trying to set all registers from bytes encoded with incorrect size", () => {
      const regs = new Registers();

      const bytesReg = new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef]);
      const fill = new Uint8Array(12 * U64_BYTES).fill(0); // we set 1st register so we fill remaining 12 with 0
      const bytes = new Uint8Array([...bytesReg, ...fill, 0x00]);

      // too many
      assert.throws(() => {
        regs.setAllEncoded(bytes);
      });

      // too little
      assert.throws(() => {
        regs.setAllEncoded(fill);
      });
    });
  });
});
