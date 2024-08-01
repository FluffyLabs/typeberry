import assert from "node:assert";
import { describe, it } from "node:test";

import { Memory } from "../memory";
import { PageMap } from "../page-map";
import { Registers } from "../registers";
import { LoadOps } from "./load-ops";

const RESULT_REGISTER = 12;

describe("LoadOps", () => {
  describe("loadImmediate", () => {
    it("should load positive number into register", () => {
      const registers = new Registers();
      const memory = new Memory(new PageMap([]), []);
      const loadOps = new LoadOps(registers, memory);
      const numberToLoad = 15;

      loadOps.loadImmediate(RESULT_REGISTER, numberToLoad);

      assert.strictEqual(registers.asSigned[RESULT_REGISTER], numberToLoad);
      assert.strictEqual(registers.asUnsigned[RESULT_REGISTER], numberToLoad);
    });

    it("should load negative number into register", () => {
      const registers = new Registers();
      const memory = new Memory(new PageMap([]), []);
      const loadOps = new LoadOps(registers, memory);
      const numberToLoad = -1;
      const expectedUnsignedNumber = 0xff_ff_ff_ff;

      loadOps.loadImmediate(RESULT_REGISTER, numberToLoad);

      assert.strictEqual(registers.asSigned[RESULT_REGISTER], numberToLoad);
      assert.strictEqual(registers.asUnsigned[RESULT_REGISTER], expectedUnsignedNumber);
    });
  });

  describe("load (U8, U16 and U32)", () => {
    it("should load u8 from memory to register", () => {
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const address = 1;
      const initialMemory = [{ address, contents: new Uint8Array([0xff, 0xee, 0xdd, 0xcc]) }];
      const memory = new Memory(pageMap, initialMemory);
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory);
      const expectedValue = 0xff;
      const registerIndex = 0;

      loadOps.loadU8(address, registerIndex);

      assert.deepStrictEqual(registers.asSigned[registerIndex], expectedValue);
      assert.deepStrictEqual(registers.asUnsigned[registerIndex], expectedValue);
    });

    it("should load u16 from memory to register", () => {
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const address = 1;
      const initialMemory = [{ address, contents: new Uint8Array([0xff, 0xee, 0xdd, 0xcc]) }];
      const memory = new Memory(pageMap, initialMemory);
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory);
      const expectedValue = 61183;
      const registerIndex = 0;

      loadOps.loadU16(address, registerIndex);

      assert.deepStrictEqual(registers.asSigned[registerIndex], expectedValue);
      assert.deepStrictEqual(registers.asUnsigned[registerIndex], expectedValue);
    });

    it("should load u32 from memory to register", () => {
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const address = 1;
      const initialMemory = [{ address, contents: new Uint8Array([0xff, 0xee, 0xdd, 0x0c]) }];
      const memory = new Memory(pageMap, initialMemory);
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory);
      const expectedValue = 215871231;
      const registerIndex = 0;

      loadOps.loadU32(address, registerIndex);

      assert.deepStrictEqual(registers.asSigned[registerIndex], expectedValue);
      assert.deepStrictEqual(registers.asUnsigned[registerIndex], expectedValue);
    });

    it("should load u32 from memory to register (negative number)", () => {
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const address = 1;
      const initialMemory = [{ address, contents: new Uint8Array([0xff, 0xff, 0xff, 0xff]) }];
      const memory = new Memory(pageMap, initialMemory);
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory);
      const expectedSignedValue = -1;
      const expectedUnsignedValue = 2 ** 32 - 1;
      const registerIndex = 0;

      loadOps.loadU32(address, registerIndex);

      assert.deepStrictEqual(registers.asSigned[registerIndex], expectedSignedValue);
      assert.deepStrictEqual(registers.asUnsigned[registerIndex], expectedUnsignedValue);
    });
  });
  
  describe("load (I8 and I16)", () => {
    it("should load i8 from memory to register", () => {
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const address = 1;
      const initialMemory = [{ address, contents: new Uint8Array([0xcc, 0xff, 0xff, 0xff]) }];
      const memory = new Memory(pageMap, initialMemory);
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory);
      const expectedSignedValue = -52;
      const expectedUnsignedValue = 4294967244;
      const registerIndex = 0;

      loadOps.loadI8(address, registerIndex);

      assert.deepStrictEqual(registers.asSigned[registerIndex], expectedSignedValue);
      assert.deepStrictEqual(registers.asUnsigned[registerIndex], expectedUnsignedValue);
    });

    it("should load i16 from memory to register", () => {
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const address = 1;
      const initialMemory = [{ address, contents: new Uint8Array([0xcc, 0xdd, 0xff, 0xff]) }];
      const memory = new Memory(pageMap, initialMemory);
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory);
      const expectedSignedValue = -8756;
      const expectedUnsignedValue = 4294958540;
      const registerIndex = 0;

      loadOps.loadI16(address, registerIndex);

      assert.deepStrictEqual(registers.asSigned[registerIndex], expectedSignedValue);
      assert.deepStrictEqual(registers.asUnsigned[registerIndex], expectedUnsignedValue);
    });
  });
});
