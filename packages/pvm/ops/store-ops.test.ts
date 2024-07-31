import assert from "node:assert";
import { describe, it } from "node:test";

import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { Memory } from "../memory";
import { PageMap } from "../page-map";
import { Registers } from "../registers";
import { StoreOps } from "./store-ops";

describe("StoreOps", () => {
  describe("store (U8, U16 and U32)", () => {
    it("should store u8 number", () => {
      const regs = new Registers();
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const address = 1;
      const registerIndex = 1;
      regs.asUnsigned[registerIndex] = 0xfe_dc_ba_98;
      const memory = new Memory(pageMap, []);
      const storeOps = new StoreOps(regs, memory);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0x98]),
        },
      ];

      storeOps.storeU8(address, registerIndex);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });

    it("should store u16 number", () => {
      const regs = new Registers();
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const address = 1;
      const registerIndex = 1;
      regs.asUnsigned[registerIndex] = 0xfe_dc_ba_98;
      const memory = new Memory(pageMap, []);
      const storeOps = new StoreOps(regs, memory);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0x98, 0xba]),
        },
      ];

      storeOps.storeU16(address, registerIndex);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });

    it("should store u32 number", () => {
      const regs = new Registers();
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const address = 1;
      const registerIndex = 1;
      regs.asUnsigned[registerIndex] = 0xfe_dc_ba_98;
      const memory = new Memory(pageMap, []);
      const storeOps = new StoreOps(regs, memory);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0x98, 0xba, 0xdc, 0xfe]),
        },
      ];

      storeOps.storeU32(address, registerIndex);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });
  });

  describe("storeImmediate (U8, U16 and U32)", () => {
    it("should store u8 number", () => {
      const regs = new Registers();
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const address = 1;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new Memory(pageMap, []);
      const storeOps = new StoreOps(regs, memory);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0xfe]),
        },
      ];

      storeOps.storeImmediateU8(address, immediateDecoder);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });

    it("should store u16 number", () => {
      const regs = new Registers();
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const address = 1;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new Memory(pageMap, []);
      const storeOps = new StoreOps(regs, memory);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0xfe, 0xdc]),
        },
      ];

      storeOps.storeImmediateU16(address, immediateDecoder);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });

    it("should store u32 number", () => {
      const regs = new Registers();
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const address = 1;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new Memory(pageMap, []);
      const storeOps = new StoreOps(regs, memory);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0xfe, 0xdc, 0xba, 0x98]),
        },
      ];

      storeOps.storeImmediateU32(address, immediateDecoder);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });
  });

  describe("storeImmediateInd (U8, U16 and U32)", () => {
    it("should store u8 number", () => {
      const regs = new Registers();
      const registerIndex = 0;
      regs.asUnsigned[registerIndex] = 1;
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const address = 2;
      const fistimmediateDecoder = new ImmediateDecoder();
      fistimmediateDecoder.setBytes(new Uint8Array([1]));
      const secondimmediateDecoder = new ImmediateDecoder();
      secondimmediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new Memory(pageMap, []);
      const storeOps = new StoreOps(regs, memory);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0xfe]),
        },
      ];

      storeOps.storeImmediateIndU8(registerIndex, fistimmediateDecoder, secondimmediateDecoder);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });

    it("should store u16 number", () => {
      const regs = new Registers();
      const registerIndex = 0;
      regs.asUnsigned[registerIndex] = 1;
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const address = 2;
      const fistimmediateDecoder = new ImmediateDecoder();
      fistimmediateDecoder.setBytes(new Uint8Array([1]));
      const secondimmediateDecoder = new ImmediateDecoder();
      secondimmediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new Memory(pageMap, []);
      const storeOps = new StoreOps(regs, memory);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0xfe, 0xdc]),
        },
      ];

      storeOps.storeImmediateIndU16(registerIndex, fistimmediateDecoder, secondimmediateDecoder);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });

    it("should store u32 number", () => {
      const regs = new Registers();
      const registerIndex = 0;
      regs.asUnsigned[registerIndex] = 1;
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const address = 2;
      const fistimmediateDecoder = new ImmediateDecoder();
      fistimmediateDecoder.setBytes(new Uint8Array([1]));
      const secondimmediateDecoder = new ImmediateDecoder();
      secondimmediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new Memory(pageMap, []);
      const storeOps = new StoreOps(regs, memory);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0xfe, 0xdc, 0xba, 0x98]),
        },
      ];

      storeOps.storeImmediateIndU32(registerIndex, fistimmediateDecoder, secondimmediateDecoder);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });
  });
});
