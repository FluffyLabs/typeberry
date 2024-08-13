import assert from "node:assert";
import { describe, it } from "node:test";

import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { InstructionResult } from "../instruction-result";
import { Memory } from "../memory";
import { SEGMENT_SIZE } from "../memory/memory-conts";
import { Registers } from "../registers";
import { StoreOps } from "./store-ops";

describe("StoreOps", () => {
  describe("store (U8, U16 and U32)", () => {
    it("should store u8 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = 2 * SEGMENT_SIZE;
      const registerIndex = 1;
      regs.asUnsigned[registerIndex] = 0xfe_dc_ba_98;
      const memory = new Memory();
      memory.setupMemory(new Uint8Array(), new Uint8Array(10), 0, 0);
      const storeOps = new StoreOps(regs, memory, instructionResult);
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
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = 2 * SEGMENT_SIZE;
      const registerIndex = 1;
      regs.asUnsigned[registerIndex] = 0xfe_dc_ba_98;
      const memory = new Memory();
      memory.setupMemory(new Uint8Array(), new Uint8Array(10), 0, 0);
      const storeOps = new StoreOps(regs, memory, instructionResult);
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
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = 2 * SEGMENT_SIZE;
      const registerIndex = 1;
      regs.asUnsigned[registerIndex] = 0xfe_dc_ba_98;
      const memory = new Memory();
      memory.setupMemory(new Uint8Array(), new Uint8Array(10), 0, 0);
      const storeOps = new StoreOps(regs, memory, instructionResult);
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
    it("should store u8 immediate number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = 2 * SEGMENT_SIZE;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new Memory();
      memory.setupMemory(new Uint8Array(), new Uint8Array(10), 0, 0);
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0xfe]),
        },
      ];

      storeOps.storeImmediateU8(address, immediateDecoder);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });

    it("should store u16 immediate number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = 2 * SEGMENT_SIZE;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new Memory();
      memory.setupMemory(new Uint8Array(), new Uint8Array(10), 0, 0);
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0xfe, 0xdc]),
        },
      ];

      storeOps.storeImmediateU16(address, immediateDecoder);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });

    it("should store u32 immediate number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = 2 * SEGMENT_SIZE;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new Memory();
      memory.setupMemory(new Uint8Array(), new Uint8Array(10), 0, 0);
      const storeOps = new StoreOps(regs, memory, instructionResult);
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
    it("should store u8 number using storeImmediateInd", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const registerIndex = 0;
      regs.asUnsigned[registerIndex] = SEGMENT_SIZE;
      const address = 2 * SEGMENT_SIZE;
      const fistimmediateDecoder = new ImmediateDecoder();
      fistimmediateDecoder.setBytes(new Uint8Array([0x0, 0x0, 0x01]));
      const secondimmediateDecoder = new ImmediateDecoder();
      secondimmediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new Memory();
      memory.setupMemory(new Uint8Array(), new Uint8Array(10), 0, 0);
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0xfe]),
        },
      ];

      storeOps.storeImmediateIndU8(registerIndex, fistimmediateDecoder, secondimmediateDecoder);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });

    it("should store u16 number storeImmediateInd", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const registerIndex = 0;
      regs.asUnsigned[registerIndex] = SEGMENT_SIZE;
      const address = 2 * SEGMENT_SIZE;
      const fistimmediateDecoder = new ImmediateDecoder();
      fistimmediateDecoder.setBytes(new Uint8Array([0x0, 0x0, 0x01]));
      const secondimmediateDecoder = new ImmediateDecoder();
      secondimmediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new Memory();
      memory.setupMemory(new Uint8Array(), new Uint8Array(10), 0, 0);
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0xfe, 0xdc]),
        },
      ];

      storeOps.storeImmediateIndU16(registerIndex, fistimmediateDecoder, secondimmediateDecoder);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });

    it("should store u32 number storeImmediateInd", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const registerIndex = 0;
      regs.asUnsigned[registerIndex] = SEGMENT_SIZE;
      const address = 2 * SEGMENT_SIZE;
      const fistimmediateDecoder = new ImmediateDecoder();
      fistimmediateDecoder.setBytes(new Uint8Array([0x0, 0x0, 0x01]));
      const secondimmediateDecoder = new ImmediateDecoder();
      secondimmediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new Memory();
      memory.setupMemory(new Uint8Array(), new Uint8Array(10), 0, 0);
      const storeOps = new StoreOps(regs, memory, instructionResult);
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

  describe("storeInd (U8, U16 and U32)", () => {
    it("should store u8 number using storeInd", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = 2 * SEGMENT_SIZE;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.asUnsigned[firstRegisterIndex] = SEGMENT_SIZE;
      regs.asUnsigned[secondRegisterIndex] = 0xfe_dc_ba_98;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([0x0, 0x0, 0x01]));
      const memory = new Memory();
      memory.setupMemory(new Uint8Array(), new Uint8Array(10), 0, 0);
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0x98]),
        },
      ];

      storeOps.storeIndU8(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });

    it("should store u16 number using storeInd", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = 2 * SEGMENT_SIZE;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.asUnsigned[firstRegisterIndex] = SEGMENT_SIZE;
      regs.asUnsigned[secondRegisterIndex] = 0xfe_dc_ba_98;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([0x0, 0x0, 0x01]));
      const memory = new Memory();
      memory.setupMemory(new Uint8Array(), new Uint8Array(10), 0, 0);
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0x98, 0xba]),
        },
      ];

      storeOps.storeIndU16(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });

    it("should store u32 number using storeInd", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = 2 * SEGMENT_SIZE;
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.asUnsigned[firstRegisterIndex] = SEGMENT_SIZE;
      regs.asUnsigned[secondRegisterIndex] = 0xfe_dc_ba_98;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([0x0, 0x0, 0x01]));
      const memory = new Memory();
      memory.setupMemory(new Uint8Array(), new Uint8Array(10), 0, 0);
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0x98, 0xba, 0xdc, 0xfe]),
        },
      ];

      storeOps.storeIndU32(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });
  });
});
