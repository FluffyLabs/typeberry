import assert from "node:assert";
import { describe, it } from "node:test";

import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { InstructionResult } from "../instruction-result";
import { MemoryBuilder } from "../memory";
import { PAGE_SIZE } from "../memory/memory-consts";
import { type MemoryIndex, tryAsMemoryIndex } from "../memory/memory-index";
import { getPageNumber, getStartPageIndex } from "../memory/memory-utils";
import { Registers } from "../registers";
import { StoreOps } from "./store-ops";

const getExpectedPage = (address: MemoryIndex, contents: Uint8Array, length: number) => {
  const pageStartIndex = getStartPageIndex(address);
  const rawPage = [...new Uint8Array(address - pageStartIndex), ...contents];
  return new Uint8Array([...rawPage, ...new Uint8Array(length - rawPage.length)]);
};

describe("StoreOps", () => {
  describe("store (U8, U16 U32 and U64)", () => {
    it("should store u8 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = tryAsMemoryIndex(1);
      const registerIndex = 1;
      regs.setU32(registerIndex, 0xfe_dc_ba_98);
      const memory = new MemoryBuilder()
        .setWriteablePages(getStartPageIndex(address), tryAsMemoryIndex(4096), new Uint8Array())
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedPage = getExpectedPage(address, new Uint8Array([0x98]), 32);

      storeOps.storeU8(address, registerIndex);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u16 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = tryAsMemoryIndex(1);
      const registerIndex = 1;
      regs.setU32(registerIndex, 0xfe_dc_ba_98);
      const memory = new MemoryBuilder()
        .setWriteablePages(getStartPageIndex(address), tryAsMemoryIndex(4096), new Uint8Array())
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedPage = getExpectedPage(address, new Uint8Array([0x98, 0xba]), 32);

      storeOps.storeU16(address, registerIndex);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u32 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = tryAsMemoryIndex(1);
      const registerIndex = 1;
      regs.setU32(registerIndex, 0xfe_dc_ba_98);
      const memory = new MemoryBuilder()
        .setWriteablePages(getStartPageIndex(address), tryAsMemoryIndex(4096), new Uint8Array())
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedPage = getExpectedPage(address, new Uint8Array([0x98, 0xba, 0xdc, 0xfe]), 32);

      storeOps.storeU32(address, registerIndex);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u64 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = tryAsMemoryIndex(1);
      const registerIndex = 1;
      regs.setU64(registerIndex, 0xfe_dc_ba_98_76_54_32_10n);
      const memory = new MemoryBuilder()
        .setWriteablePages(getStartPageIndex(address), tryAsMemoryIndex(4096), new Uint8Array())
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedPage = getExpectedPage(
        address,
        new Uint8Array([0x10, 0x32, 0x54, 0x76, 0x98, 0xba, 0xdc, 0xfe]),
        32,
      );

      storeOps.storeU64(address, registerIndex);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });
  });

  describe("storeImmediate (U8, U16 U32 and U64)", () => {
    it("should store u8 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = tryAsMemoryIndex(1);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new MemoryBuilder()
        .setWriteablePages(getStartPageIndex(address), tryAsMemoryIndex(4096), new Uint8Array())
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedPage = getExpectedPage(address, new Uint8Array([0xfe]), 32);

      storeOps.storeImmediateU8(address, immediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u16 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = tryAsMemoryIndex(1);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new MemoryBuilder()
        .setWriteablePages(getStartPageIndex(address), tryAsMemoryIndex(4096), new Uint8Array())
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedPage = getExpectedPage(address, new Uint8Array([0xfe, 0xdc]), 32);

      storeOps.storeImmediateU16(address, immediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u32 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = tryAsMemoryIndex(1);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new MemoryBuilder()
        .setWriteablePages(getStartPageIndex(address), tryAsMemoryIndex(4096), new Uint8Array())
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedPage = getExpectedPage(address, new Uint8Array([0xfe, 0xdc, 0xba, 0x98]), 32);

      storeOps.storeImmediateU32(address, immediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u64 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = tryAsMemoryIndex(0);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98, 0x76]));
      const memory = new MemoryBuilder()
        .setWriteablePages(getStartPageIndex(address), tryAsMemoryIndex(4096), new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedPage = getExpectedPage(
        address,
        new Uint8Array([0xfe, 0xdc, 0xba, 0x98, 0x00, 0x00, 0x00, 0x00]),
        32,
      );

      storeOps.storeImmediateU64(address, immediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });
  });

  describe("storeImmediateInd (U8, U16 U32 and U64)", () => {
    it("should store u8 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const registerIndex = 0;
      regs.setU32(registerIndex, 1);
      const address = tryAsMemoryIndex(2);
      const fistimmediateDecoder = new ImmediateDecoder();
      fistimmediateDecoder.setBytes(new Uint8Array([1]));
      const secondimmediateDecoder = new ImmediateDecoder();
      secondimmediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new MemoryBuilder()
        .setWriteablePages(getStartPageIndex(address), tryAsMemoryIndex(4096), new Uint8Array())
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedPage = getExpectedPage(address, new Uint8Array([0xfe]), 32);

      storeOps.storeImmediateIndU8(registerIndex, fistimmediateDecoder, secondimmediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u16 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const registerIndex = 0;
      regs.setU32(registerIndex, 1);
      const address = tryAsMemoryIndex(2);
      const fistimmediateDecoder = new ImmediateDecoder();
      fistimmediateDecoder.setBytes(new Uint8Array([1]));
      const secondimmediateDecoder = new ImmediateDecoder();
      secondimmediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new MemoryBuilder()
        .setWriteablePages(getStartPageIndex(address), tryAsMemoryIndex(4096), new Uint8Array())
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedPage = getExpectedPage(address, new Uint8Array([0xfe, 0xdc]), 32);

      storeOps.storeImmediateIndU16(registerIndex, fistimmediateDecoder, secondimmediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u32 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const registerIndex = 0;
      regs.setU32(registerIndex, 1);
      const address = tryAsMemoryIndex(2);
      const fistimmediateDecoder = new ImmediateDecoder();
      fistimmediateDecoder.setBytes(new Uint8Array([1]));
      const secondimmediateDecoder = new ImmediateDecoder();
      secondimmediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new MemoryBuilder()
        .setWriteablePages(getStartPageIndex(address), tryAsMemoryIndex(4096), new Uint8Array())
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedPage = getExpectedPage(address, new Uint8Array([0xfe, 0xdc, 0xba, 0x98]), 32);

      storeOps.storeImmediateIndU32(registerIndex, fistimmediateDecoder, secondimmediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u64 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const registerIndex = 0;
      regs.setU32(registerIndex, 1);
      const address = tryAsMemoryIndex(2);
      const fistimmediateDecoder = new ImmediateDecoder();
      fistimmediateDecoder.setBytes(new Uint8Array([1]));
      const secondimmediateDecoder = new ImmediateDecoder();
      secondimmediateDecoder.setBytes(new Uint8Array([0xfe, 0xdc, 0xba, 0x98]));
      const memory = new MemoryBuilder()
        .setWriteablePages(tryAsMemoryIndex(0), tryAsMemoryIndex(4096), new Uint8Array([5, 5, 1, 2, 3, 4, 5, 6, 7, 8]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedPage = getExpectedPage(
        tryAsMemoryIndex(0),
        new Uint8Array([5, 5, 0xfe, 0xdc, 0xba, 0x98, 0, 0, 0, 0]),
        32,
      );

      storeOps.storeImmediateIndU64(registerIndex, fistimmediateDecoder, secondimmediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });
  });

  describe("storeInd (U8, U16 U32 and U64)", () => {
    it("should store u8 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = tryAsMemoryIndex(2);
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.setU32(firstRegisterIndex, 1);
      regs.setU32(secondRegisterIndex, 0xfe_dc_ba_98);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const memory = new MemoryBuilder()
        .setWriteablePages(getStartPageIndex(address), tryAsMemoryIndex(4096), new Uint8Array())
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedPage = getExpectedPage(address, new Uint8Array([0x98]), 32);

      storeOps.storeIndU8(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u16 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = tryAsMemoryIndex(2);
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.setU32(firstRegisterIndex, 1);
      regs.setU32(secondRegisterIndex, 0xfe_dc_ba_98);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const memory = new MemoryBuilder()
        .setWriteablePages(getStartPageIndex(address), tryAsMemoryIndex(4096), new Uint8Array())
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedPage = getExpectedPage(address, new Uint8Array([0x98, 0xba]), 32);

      storeOps.storeIndU16(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u32 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = tryAsMemoryIndex(2);
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.setU32(firstRegisterIndex, 1);
      regs.setU32(secondRegisterIndex, 0xfe_dc_ba_98);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const memory = new MemoryBuilder()
        .setWriteablePages(getStartPageIndex(address), tryAsMemoryIndex(4096), new Uint8Array())
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedPage = getExpectedPage(address, new Uint8Array([0x98, 0xba, 0xdc, 0xfe]), 32);

      storeOps.storeIndU32(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u64 number", () => {
      const instructionResult = new InstructionResult();
      const regs = new Registers();
      const address = tryAsMemoryIndex(2);
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      regs.setU32(firstRegisterIndex, 1);
      regs.setU32(secondRegisterIndex, 0xfe_dc_ba_98);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const memory = new MemoryBuilder()
        .setWriteablePages(tryAsMemoryIndex(0), tryAsMemoryIndex(4096), new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const storeOps = new StoreOps(regs, memory, instructionResult);
      const expectedPage = getExpectedPage(
        tryAsMemoryIndex(0),
        new Uint8Array([1, 2, 0x98, 0xba, 0xdc, 0xfe, 0xff, 0xff, 0xff, 0xff]),
        32,
      );

      storeOps.storeIndU64(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });
  });
});
