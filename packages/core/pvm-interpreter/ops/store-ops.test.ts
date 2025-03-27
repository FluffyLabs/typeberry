import assert from "node:assert";
import { describe, it } from "node:test";

import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { InstructionResult } from "../instruction-result";
import { MemoryBuilder } from "../memory";
import { PAGE_SIZE } from "../memory/memory-consts";
import { type MemoryIndex, tryAsMemoryIndex, tryAsSbrkIndex } from "../memory/memory-index";
import { getPageNumber, getStartPageIndex } from "../memory/memory-utils";
import { Registers } from "../registers";
import { bigintToUint8ArrayLE } from "../test-utils";
import { StoreOps } from "./store-ops";

const getExpectedPage = (address: MemoryIndex, contents: Uint8Array, length: number) => {
  const pageStartIndex = getStartPageIndex(address);
  const prefix = new Uint8Array(address - pageStartIndex);
  const suffix = new Uint8Array(length - prefix.length - contents.length);
  prefix.fill(0x1);
  suffix.fill(0x1);
  const rawPage = [...prefix, ...contents];
  return new Uint8Array([...rawPage, ...suffix]);
};

describe("StoreOps", () => {
  function prepareStoreData(valueToStore: bigint, noOfBytes: 1 | 2 | 4 | 8) {
    const instructionResult = new InstructionResult();
    const regs = new Registers();
    const address = tryAsMemoryIndex(1);
    const registerIndex = 1;
    regs.setU64(registerIndex, valueToStore);
    const initialMemory = new Uint8Array(32);
    initialMemory.fill(0x1);
    const memory = new MemoryBuilder()
      .setWriteablePages(getStartPageIndex(address), tryAsMemoryIndex(4096), initialMemory)
      .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
    const storeOps = new StoreOps(regs, memory, instructionResult);
    const expectedPage = getExpectedPage(address, bigintToUint8ArrayLE(valueToStore, noOfBytes), 32);

    const immediate = new ImmediateDecoder();
    immediate.setBytes(bigintToUint8ArrayLE(valueToStore, noOfBytes));

    return { storeOps, address, registerIndex, memory, expectedPage, immediate };
  }
  describe("store (U8, U16 U32 and U64)", () => {
    it("should store u8 number", () => {
      const valueToStore = 0xfe_dc_ba_98n;
      const { storeOps, registerIndex, address, memory, expectedPage } = prepareStoreData(valueToStore, 1);

      storeOps.storeU8(address, registerIndex);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u16 number", () => {
      const valueToStore = 0xfe_dc_ba_98n;
      const { storeOps, registerIndex, address, memory, expectedPage } = prepareStoreData(valueToStore, 2);

      storeOps.storeU16(address, registerIndex);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u32 number", () => {
      const valueToStore = 0xfe_dc_ba_98n;
      const { storeOps, registerIndex, address, memory, expectedPage } = prepareStoreData(valueToStore, 4);

      storeOps.storeU32(address, registerIndex);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u64 number", () => {
      const valueToStore = 0xfe_dc_ba_98_76_54_32_10n;
      const { storeOps, registerIndex, address, memory, expectedPage } = prepareStoreData(valueToStore, 8);

      storeOps.storeU64(address, registerIndex);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });
  });

  describe("storeImmediate (U8, U16 U32 and U64)", () => {
    it("should store u8 number", () => {
      const valueToStore = 0xfe_dc_ba_98n;
      const { storeOps, immediate, address, memory, expectedPage } = prepareStoreData(valueToStore, 1);

      storeOps.storeImmediateU8(address, immediate);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u16 number", () => {
      const valueToStore = 0xfe_dc_ba_98n;
      const { storeOps, immediate, address, memory, expectedPage } = prepareStoreData(valueToStore, 2);

      storeOps.storeImmediateU16(address, immediate);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u32 number", () => {
      const valueToStore = 0xfe_dc_ba_98n;
      const { storeOps, immediate, address, memory, expectedPage } = prepareStoreData(valueToStore, 4);

      storeOps.storeImmediateU32(address, immediate);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u64 number", () => {
      const valueToStore = -19088744n;
      const { storeOps, immediate, address, memory, expectedPage } = prepareStoreData(valueToStore, 8);

      storeOps.storeImmediateU64(address, immediate);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });
  });

  function prepareStoreIndData(
    valueToStore: bigint,
    noOfBytes: 1 | 2 | 4 | 8,
    addressRegisterValue: bigint,
    addressImmediateValue: bigint,
  ) {
    const instructionResult = new InstructionResult();
    const regs = new Registers();
    const address = tryAsMemoryIndex(Number(addressRegisterValue + addressImmediateValue));
    const addressRegisterIndex = 0;
    const valueRegisterIndex = 1;
    regs.setU64(valueRegisterIndex, valueToStore);
    regs.setU64(addressRegisterIndex, addressRegisterValue);
    const initialMemory = new Uint8Array(32);
    initialMemory.fill(0x1);
    const memory = new MemoryBuilder()
      .setWriteablePages(getStartPageIndex(address), tryAsMemoryIndex(4096), initialMemory)
      .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
    const storeOps = new StoreOps(regs, memory, instructionResult);
    const expectedPage = getExpectedPage(address, bigintToUint8ArrayLE(valueToStore, noOfBytes), 32);

    const valueImmediate = new ImmediateDecoder();
    valueImmediate.setBytes(bigintToUint8ArrayLE(valueToStore, noOfBytes));

    const addressImmediate = new ImmediateDecoder();
    addressImmediate.setBytes(bigintToUint8ArrayLE(addressImmediateValue));

    return {
      storeOps,
      address,
      valueRegisterIndex,
      addressRegisterIndex,
      memory,
      expectedPage,
      valueImmediate,
      addressImmediate,
    };
  }

  describe("storeImmediateInd (U8, U16 U32 and U64)", () => {
    it("should store u8 number", () => {
      const valueToStore = 0xfe_dc_ba_98n;
      const addressImmediateValue = 1n;
      const addressRegisterValue = 1n;
      const { storeOps, valueImmediate, addressImmediate, address, memory, expectedPage, addressRegisterIndex } =
        prepareStoreIndData(valueToStore, 1, addressRegisterValue, addressImmediateValue);

      storeOps.storeImmediateIndU8(addressRegisterIndex, addressImmediate, valueImmediate);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u16 number", () => {
      const valueToStore = 0xfe_dc_ba_98n;
      const addressImmediateValue = 1n;
      const addressRegisterValue = 1n;
      const { storeOps, valueImmediate, addressImmediate, address, memory, expectedPage, addressRegisterIndex } =
        prepareStoreIndData(valueToStore, 2, addressRegisterValue, addressImmediateValue);

      storeOps.storeImmediateIndU16(addressRegisterIndex, addressImmediate, valueImmediate);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u32 number", () => {
      const valueToStore = 0xfe_dc_ba_98n;
      const addressImmediateValue = 1n;
      const addressRegisterValue = 1n;
      const { storeOps, valueImmediate, addressImmediate, address, memory, expectedPage, addressRegisterIndex } =
        prepareStoreIndData(valueToStore, 4, addressRegisterValue, addressImmediateValue);

      storeOps.storeImmediateIndU32(addressRegisterIndex, addressImmediate, valueImmediate);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u64 number", () => {
      const valueToStore = -19088744n;
      const addressImmediateValue = 1n;
      const addressRegisterValue = 1n;
      const { storeOps, valueImmediate, addressImmediate, address, memory, expectedPage, addressRegisterIndex } =
        prepareStoreIndData(valueToStore, 8, addressRegisterValue, addressImmediateValue);

      storeOps.storeImmediateIndU64(addressRegisterIndex, addressImmediate, valueImmediate);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });
  });

  describe("storeInd (U8, U16 U32 and U64)", () => {
    it("should store u8 number", () => {
      const valueToStore = 0xfe_dc_ba_98n;
      const addressImmediateValue = 1n;
      const addressRegisterValue = 1n;
      const { storeOps, valueRegisterIndex, addressImmediate, address, memory, expectedPage, addressRegisterIndex } =
        prepareStoreIndData(valueToStore, 1, addressRegisterValue, addressImmediateValue);

      storeOps.storeIndU8(valueRegisterIndex, addressRegisterIndex, addressImmediate);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u16 number", () => {
      const valueToStore = 0xfe_dc_ba_98n;
      const addressImmediateValue = 1n;
      const addressRegisterValue = 1n;
      const { storeOps, valueRegisterIndex, addressImmediate, address, memory, expectedPage, addressRegisterIndex } =
        prepareStoreIndData(valueToStore, 2, addressRegisterValue, addressImmediateValue);

      storeOps.storeIndU16(valueRegisterIndex, addressRegisterIndex, addressImmediate);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u32 number", () => {
      const valueToStore = 0xfe_dc_ba_98n;
      const addressImmediateValue = 1n;
      const addressRegisterValue = 1n;
      const { storeOps, valueRegisterIndex, addressImmediate, address, memory, expectedPage, addressRegisterIndex } =
        prepareStoreIndData(valueToStore, 4, addressRegisterValue, addressImmediateValue);

      storeOps.storeIndU32(valueRegisterIndex, addressRegisterIndex, addressImmediate);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });

    it("should store u64 number", () => {
      const valueToStore = 0xfe_dc_ba_98n;
      const addressImmediateValue = 1n;
      const addressRegisterValue = 1n;
      const { storeOps, valueRegisterIndex, addressImmediate, address, memory, expectedPage, addressRegisterIndex } =
        prepareStoreIndData(valueToStore, 8, addressRegisterValue, addressImmediateValue);

      storeOps.storeIndU64(valueRegisterIndex, addressRegisterIndex, addressImmediate);

      const page = memory.getPageDump(getPageNumber(address));
      assert.deepStrictEqual(page, expectedPage);
    });
  });
});
