import assert from "node:assert";
import { describe, it } from "node:test";

import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { InstructionResult } from "../instruction-result";
import { MemoryBuilder } from "../memory";
import { PAGE_SIZE } from "../memory/memory-consts";
import { type MemoryIndex, createMemoryIndex } from "../memory/memory-index";
import { getPageNumber, getStartPageIndex } from "../memory/memory-utils";
import { Registers } from "../registers";
import { StoreOps } from "./store-ops";

function transformPageDump(data: Uint8Array, offset: MemoryIndex) {
  const blocks: {
    address: MemoryIndex;
    contents: Uint8Array;
  }[] = [];
  let start: MemoryIndex | null = null;

  for (let i = 0; i < data.length; i++) {
    if (data[i] > 0) {
      if (start === null) {
        start = createMemoryIndex(i + offset);
      }
    } else {
      if (start !== null) {
        blocks.push({
          address: start,
          contents: data.subarray(start, i),
        });
        start = null;
      }
    }
  }

  if (start !== null) {
    blocks.push({
      address: start,
      contents: data.subarray(start),
    });
  }

  return blocks;
}

describe("StoreOps", () => {
  describe("store (U8, U16 and U32)", () => {
    it("should store u8 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = createMemoryIndex(1);
      const registerIndex = 1;
      regs.asUnsigned[registerIndex] = 0xfe_dc_ba_98;
      const memory = new MemoryBuilder()
        .setWriteable(address, createMemoryIndex(4096), new Uint8Array())
        .finalize(createMemoryIndex(PAGE_SIZE), createMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0x98]),
        },
      ];

      storeOps.storeU8(address, registerIndex);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(transformPageDump(page, getStartPageIndex(address)), expectedMemory);
    });

    it("should store u16 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = createMemoryIndex(1);
      const registerIndex = 1;
      regs.asUnsigned[registerIndex] = 0xfe_dc_ba_98;
      const memory = new MemoryBuilder()
        .setWriteable(address, createMemoryIndex(4096), new Uint8Array())
        .finalize(createMemoryIndex(PAGE_SIZE), createMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0x98, 0xba]),
        },
      ];

      storeOps.storeU16(address, registerIndex);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(transformPageDump(page, getStartPageIndex(address)), expectedMemory);
    });

    it("should store u32 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = createMemoryIndex(1);
      const registerIndex = 1;
      regs.asUnsigned[registerIndex] = 0xfe_dc_ba_98;
      const memory = new MemoryBuilder()
        .setWriteable(address, createMemoryIndex(4096), new Uint8Array())
        .finalize(createMemoryIndex(PAGE_SIZE), createMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0x98, 0xba, 0xdc, 0xfe]),
        },
      ];

      storeOps.storeU32(address, registerIndex);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(transformPageDump(page, getStartPageIndex(address)), expectedMemory);
    });
  });

  describe("storeImmediate (U8, U16 and U32)", () => {
    it("should store u8 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = createMemoryIndex(1);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new MemoryBuilder()
        .setWriteable(address, createMemoryIndex(4096), new Uint8Array())
        .finalize(createMemoryIndex(PAGE_SIZE), createMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0xfe]),
        },
      ];

      storeOps.storeImmediateU8(address, immediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(transformPageDump(page, getStartPageIndex(address)), expectedMemory);
    });

    it("should store u16 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = createMemoryIndex(1);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new MemoryBuilder()
        .setWriteable(address, createMemoryIndex(4096), new Uint8Array())
        .finalize(createMemoryIndex(PAGE_SIZE), createMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0xfe, 0xdc]),
        },
      ];

      storeOps.storeImmediateU16(address, immediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(transformPageDump(page, getStartPageIndex(address)), expectedMemory);
    });

    it("should store u32 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = createMemoryIndex(1);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new MemoryBuilder()
        .setWriteable(address, createMemoryIndex(4096), new Uint8Array())
        .finalize(createMemoryIndex(PAGE_SIZE), createMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0xfe, 0xdc, 0xba, 0x98]),
        },
      ];

      storeOps.storeImmediateU32(address, immediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(transformPageDump(page, getStartPageIndex(address)), expectedMemory);
    });
  });

  describe("storeImmediateInd (U8, U16 and U32)", () => {
    it("should store u8 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const registerIndex = 0;
      regs.asUnsigned[registerIndex] = 1;
      const address = createMemoryIndex(2);
      const fistimmediateDecoder = new ImmediateDecoder();
      fistimmediateDecoder.setBytes(new Uint8Array([1]));
      const secondimmediateDecoder = new ImmediateDecoder();
      secondimmediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new MemoryBuilder()
        .setWriteable(address, createMemoryIndex(4096), new Uint8Array())
        .finalize(createMemoryIndex(PAGE_SIZE), createMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0xfe]),
        },
      ];

      storeOps.storeImmediateIndU8(registerIndex, fistimmediateDecoder, secondimmediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(transformPageDump(page, getStartPageIndex(address)), expectedMemory);
    });

    it("should store u16 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const registerIndex = 0;
      regs.asUnsigned[registerIndex] = 1;
      const address = createMemoryIndex(2);
      const fistimmediateDecoder = new ImmediateDecoder();
      fistimmediateDecoder.setBytes(new Uint8Array([1]));
      const secondimmediateDecoder = new ImmediateDecoder();
      secondimmediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new MemoryBuilder()
        .setWriteable(address, createMemoryIndex(4096), new Uint8Array())
        .finalize(createMemoryIndex(PAGE_SIZE), createMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0xfe, 0xdc]),
        },
      ];

      storeOps.storeImmediateIndU16(registerIndex, fistimmediateDecoder, secondimmediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(transformPageDump(page, getStartPageIndex(address)), expectedMemory);
    });

    it("should store u32 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const registerIndex = 0;
      regs.asUnsigned[registerIndex] = 1;
      const address = createMemoryIndex(2);
      const fistimmediateDecoder = new ImmediateDecoder();
      fistimmediateDecoder.setBytes(new Uint8Array([1]));
      const secondimmediateDecoder = new ImmediateDecoder();
      secondimmediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new MemoryBuilder()
        .setWriteable(address, createMemoryIndex(4096), new Uint8Array())
        .finalize(createMemoryIndex(PAGE_SIZE), createMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0xfe, 0xdc, 0xba, 0x98]),
        },
      ];

      storeOps.storeImmediateIndU32(registerIndex, fistimmediateDecoder, secondimmediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(transformPageDump(page, getStartPageIndex(address)), expectedMemory);
    });
  });

  describe("storeInd (U8, U16 and U32)", () => {
    it("should store u8 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = createMemoryIndex(2);
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.asUnsigned[firstRegisterIndex] = 1;
      regs.asUnsigned[secondRegisterIndex] = 0xfe_dc_ba_98;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const memory = new MemoryBuilder()
        .setWriteable(address, createMemoryIndex(4096), new Uint8Array())
        .finalize(createMemoryIndex(PAGE_SIZE), createMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0x98]),
        },
      ];

      storeOps.storeIndU8(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(transformPageDump(page, getStartPageIndex(address)), expectedMemory);
    });

    it("should store u16 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = createMemoryIndex(2);
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.asUnsigned[firstRegisterIndex] = 1;
      regs.asUnsigned[secondRegisterIndex] = 0xfe_dc_ba_98;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const memory = new MemoryBuilder()
        .setWriteable(address, createMemoryIndex(4096), new Uint8Array())
        .finalize(createMemoryIndex(PAGE_SIZE), createMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0x98, 0xba]),
        },
      ];

      storeOps.storeIndU16(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(transformPageDump(page, getStartPageIndex(address)), expectedMemory);
    });

    it("should store u32 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = createMemoryIndex(2);
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.asUnsigned[firstRegisterIndex] = 1;
      regs.asUnsigned[secondRegisterIndex] = 0xfe_dc_ba_98;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const memory = new MemoryBuilder()
        .setWriteable(address, createMemoryIndex(4096), new Uint8Array())
        .finalize(createMemoryIndex(PAGE_SIZE), createMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedMemory = [
        {
          address,
          contents: new Uint8Array([0x98, 0xba, 0xdc, 0xfe]),
        },
      ];

      storeOps.storeIndU32(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(transformPageDump(page, getStartPageIndex(address)), expectedMemory);
    });
  });
});
