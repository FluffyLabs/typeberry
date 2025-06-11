import assert from "node:assert";
import { describe, it } from "node:test";

import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder.js";
import { InstructionResult } from "../instruction-result.js";
import { Memory, MemoryBuilder } from "../memory/index.js";
import { PAGE_SIZE, RESERVED_NUMBER_OF_PAGES } from "../memory/memory-consts.js";
import { type MemoryIndex, tryAsMemoryIndex, tryAsSbrkIndex } from "../memory/memory-index.js";
import { getStartPageIndex } from "../memory/memory-utils.js";
import { Registers } from "../registers.js";
import { bigintToUint8ArrayLE } from "../test-utils.js";
import { LoadOps } from "./load-ops.js";

describe("LoadOps", () => {
  describe("loadImmediate", () => {
    function prepareLoadImmediateData(numberToLoad: bigint) {
      const instructionResult = new InstructionResult();
      const registers = new Registers();
      const memory = new Memory();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(bigintToUint8ArrayLE(numberToLoad));

      return {
        registers,
        loadOps,
        immediateDecoder,
        resultRegister: 12,
      };
    }

    it("should load positive number into register", () => {
      const numberToLoad = 15n;
      const { resultRegister, loadOps, registers, immediateDecoder } = prepareLoadImmediateData(numberToLoad);

      loadOps.loadImmediate(resultRegister, immediateDecoder);

      assert.strictEqual(registers.getI64(resultRegister), numberToLoad);
      assert.strictEqual(registers.getU64(resultRegister), numberToLoad);
    });

    it("should load negative number into register", () => {
      const numberToLoad = -1n;
      const { resultRegister, loadOps, registers, immediateDecoder } = prepareLoadImmediateData(numberToLoad);
      const expectedUnsignedNumber = 2n ** 64n - 1n;

      loadOps.loadImmediate(resultRegister, immediateDecoder);

      assert.strictEqual(registers.getI64(resultRegister), numberToLoad);
      assert.strictEqual(registers.getU64(resultRegister), expectedUnsignedNumber);
    });
  });

  function prepareLoadData(address: MemoryIndex, data: Uint8Array) {
    const instructionResult = new InstructionResult();

    const memory = new MemoryBuilder()
      .setWriteablePages(getStartPageIndex(address), tryAsMemoryIndex(getStartPageIndex(address) + PAGE_SIZE), data)
      .finalize(tryAsMemoryIndex(20 * PAGE_SIZE), tryAsSbrkIndex(30 * PAGE_SIZE));
    const registers = new Registers();
    const loadOps = new LoadOps(registers, memory, instructionResult);
    const registerIndex = 0;
    registers.setU64(registerIndex, 0x11_22_33_44_55_66_77_88n);

    return {
      loadOps,
      registers,
      registerIndex,
    };
  }

  describe("load (U8, U16, U32 and U64)", () => {
    it("should load u8 from memory to register and extend the number to the register size", () => {
      const address = tryAsMemoryIndex(1 + RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);
      const data = new Uint8Array([0x11, 0xff, 0xee, 0xdd, 0xcc]);
      const { loadOps, registers, registerIndex } = prepareLoadData(address, data);
      const expectedValue = 0xffn;

      loadOps.loadU8(address, registerIndex);

      assert.deepStrictEqual(registers.getI64(registerIndex), expectedValue);
      assert.deepStrictEqual(registers.getU64(registerIndex), expectedValue);
    });

    it("should load u16 from memory to register and extend the number to the register size", () => {
      const address = tryAsMemoryIndex(1 + RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);
      const data = new Uint8Array([0x11, 0xff, 0xee, 0xdd, 0xcc]);
      const { loadOps, registers, registerIndex } = prepareLoadData(address, data);
      const expectedValue = 61183n;

      loadOps.loadU16(address, registerIndex);

      assert.deepStrictEqual(registers.getI64(registerIndex), expectedValue);
      assert.deepStrictEqual(registers.getU64(registerIndex), expectedValue);
    });

    it("should load u32 from memory to register and extend the number to the register size", () => {
      const address = tryAsMemoryIndex(1 + RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);
      const data = new Uint8Array([0x11, 0xff, 0xee, 0xdd, 0x0c]);
      const { loadOps, registers, registerIndex } = prepareLoadData(address, data);
      const expectedValue = 215871231n;

      loadOps.loadU32(address, registerIndex);

      assert.deepStrictEqual(registers.getI64(registerIndex), expectedValue);
      assert.deepStrictEqual(registers.getU64(registerIndex), expectedValue);
    });

    it("should load u64 from memory to register (negative number)", () => {
      const address = tryAsMemoryIndex(1 + RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);
      const data = new Uint8Array([0x11, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
      const { loadOps, registers, registerIndex } = prepareLoadData(address, data);
      const expectedSignedValue = -1n;
      const expectedUnsignedValue = 2n ** 64n - 1n;

      loadOps.loadU64(address, registerIndex);

      assert.deepStrictEqual(registers.getI64(registerIndex), expectedSignedValue);
      assert.deepStrictEqual(registers.getU64(registerIndex), expectedUnsignedValue);
    });

    it("should load u64 from memory to register", () => {
      const address = tryAsMemoryIndex(1 + RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);
      const data = new Uint8Array([0x11, 0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa, 0x99, 0x08]);
      const { loadOps, registers, registerIndex } = prepareLoadData(address, data);
      const expectedValue = 0x08_99_aa_bb_cc_dd_ee_ffn;

      loadOps.loadU64(address, registerIndex);

      assert.deepStrictEqual(registers.getI64(registerIndex), expectedValue);
      assert.deepStrictEqual(registers.getU64(registerIndex), expectedValue);
    });
  });

  describe("load (I8, I16 and I32)", () => {
    it("should load i8 from memory to register and extend the number to the register size", () => {
      const address = tryAsMemoryIndex(1 + RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);
      const data = new Uint8Array([0x11, 0xcc, 0xff, 0xff, 0xff]);
      const { loadOps, registers, registerIndex } = prepareLoadData(address, data);
      const expectedSignedValue = -52n;
      const expectedUnsignedValue = 18446744073709551564n;

      loadOps.loadI8(address, registerIndex);

      assert.deepStrictEqual(registers.getU64(registerIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(registerIndex), expectedSignedValue);
    });

    it("should load i16 from memory to register and extend the number to the register size", () => {
      const address = tryAsMemoryIndex(1 + RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);
      const data = new Uint8Array([0x11, 0xcc, 0xdd, 0xff, 0xff]);
      const { loadOps, registers, registerIndex } = prepareLoadData(address, data);
      const expectedSignedValue = -8756n;
      const expectedUnsignedValue = 18446744073709542860n;

      loadOps.loadI16(address, registerIndex);

      assert.deepStrictEqual(registers.getU64(registerIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(registerIndex), expectedSignedValue);
    });

    it("should load i32 from memory to register and extend the number to the register size", () => {
      const address = tryAsMemoryIndex(1 + RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);
      const data = new Uint8Array([0x11, 0xcc, 0xdd, 0xff, 0xff]);
      const { loadOps, registers, registerIndex } = prepareLoadData(address, data);
      const expectedSignedValue = -8756n;
      const expectedUnsignedValue = 18446744073709542860n;

      loadOps.loadI32(address, registerIndex);

      assert.deepStrictEqual(registers.getU64(registerIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(registerIndex), expectedSignedValue);
    });
  });

  function prepareLoadIndData(address: MemoryIndex, data: Uint8Array, registerValue: bigint, immediateValue: bigint) {
    const instructionResult = new InstructionResult();

    const memory = new MemoryBuilder()
      .setWriteablePages(getStartPageIndex(address), tryAsMemoryIndex(getStartPageIndex(address) + PAGE_SIZE), data)
      .finalize(tryAsMemoryIndex(20 * PAGE_SIZE), tryAsSbrkIndex(30 * PAGE_SIZE));
    const registers = new Registers();
    const loadOps = new LoadOps(registers, memory, instructionResult);
    const addressRegisterIndex = 1;
    const resultRegisterIndex = 0;
    registers.setU64(addressRegisterIndex, registerValue);

    const immediate = new ImmediateDecoder();
    immediate.setBytes(bigintToUint8ArrayLE(immediateValue));

    return {
      loadOps,
      registers,
      addressRegisterIndex,
      resultRegisterIndex,
      immediate,
    };
  }

  describe("loadInd (I8 I16 and I32)", () => {
    it("should load i8 from memory to register and extend the number to the register size", () => {
      const address = tryAsMemoryIndex(1 + RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);
      const data = new Uint8Array([0x11, 0x11, 0xcc, 0xff, 0xff, 0xff]);
      const { loadOps, registers, resultRegisterIndex, addressRegisterIndex, immediate } = prepareLoadIndData(
        address,
        data,
        1n + 16n * BigInt(PAGE_SIZE),
        1n,
      );
      const expectedSignedValue = -52n;
      const expectedUnsignedValue = 18446744073709551564n;

      loadOps.loadIndI8(resultRegisterIndex, addressRegisterIndex, immediate);

      assert.deepStrictEqual(registers.getU64(resultRegisterIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(resultRegisterIndex), expectedSignedValue);
    });

    it("should load i16 from memory to register and extend the number to the register size", () => {
      const address = tryAsMemoryIndex(1 + RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);
      const data = new Uint8Array([0x11, 0x11, 0xcc, 0xdd, 0xff, 0xff]);
      const { loadOps, registers, resultRegisterIndex, addressRegisterIndex, immediate } = prepareLoadIndData(
        address,
        data,
        1n + 16n * BigInt(PAGE_SIZE),
        1n,
      );
      const expectedSignedValue = -8756n;
      const expectedUnsignedValue = 18446744073709542860n;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));

      loadOps.loadIndI16(resultRegisterIndex, addressRegisterIndex, immediate);

      assert.deepStrictEqual(registers.getU64(resultRegisterIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(resultRegisterIndex), expectedSignedValue);
    });

    it("should load i32 from memory to register and extend the number to the register size", () => {
      const address = tryAsMemoryIndex(1 + RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);
      const data = new Uint8Array([0x11, 0x11, 0xcc, 0xdd, 0xff, 0xff]);
      const { loadOps, registers, resultRegisterIndex, addressRegisterIndex, immediate } = prepareLoadIndData(
        address,
        data,
        1n + 16n * BigInt(PAGE_SIZE),
        1n,
      );
      const expectedSignedValue = -8756n;
      const expectedUnsignedValue = 18446744073709542860n;

      loadOps.loadIndI32(resultRegisterIndex, addressRegisterIndex, immediate);

      assert.deepStrictEqual(registers.getU64(resultRegisterIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(resultRegisterIndex), expectedSignedValue);
    });
  });

  describe("loadInd (U8, U16 and U32)", () => {
    it("should load u8 from memory to register and extend the number to the register size", () => {
      const address = tryAsMemoryIndex(1 + RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);
      const data = new Uint8Array([0x11, 0x11, 0xff, 0xee, 0xdd, 0xcc]);
      const { loadOps, registers, resultRegisterIndex, addressRegisterIndex, immediate } = prepareLoadIndData(
        address,
        data,
        1n + 16n * BigInt(PAGE_SIZE),
        1n,
      );
      const expectedValue = 0xffn;

      loadOps.loadIndU8(resultRegisterIndex, addressRegisterIndex, immediate);

      assert.deepStrictEqual(registers.getU64(resultRegisterIndex), expectedValue);
      assert.deepStrictEqual(registers.getI64(resultRegisterIndex), expectedValue);
    });

    it("should load u16 from memory to register and extend the number to the register size", () => {
      const address = tryAsMemoryIndex(1 + RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);
      const data = new Uint8Array([0x11, 0x11, 0xff, 0xee, 0xdd, 0xcc]);
      const { loadOps, registers, resultRegisterIndex, addressRegisterIndex, immediate } = prepareLoadIndData(
        address,
        data,
        1n + 16n * BigInt(PAGE_SIZE),
        1n,
      );
      const expectedValue = 61183n;

      loadOps.loadIndU16(resultRegisterIndex, addressRegisterIndex, immediate);

      assert.deepStrictEqual(registers.getU64(resultRegisterIndex), expectedValue);
      assert.deepStrictEqual(registers.getI64(resultRegisterIndex), expectedValue);
    });

    it("should load u32 from memory to register and extend the number to the register size", () => {
      const address = tryAsMemoryIndex(1 + RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);
      const data = new Uint8Array([0x11, 0x11, 0xff, 0xee, 0xdd, 0x0c]);
      const { loadOps, registers, resultRegisterIndex, addressRegisterIndex, immediate } = prepareLoadIndData(
        address,
        data,
        1n + 16n * BigInt(PAGE_SIZE),
        1n,
      );
      const expectedValue = 215871231n;

      loadOps.loadIndU32(resultRegisterIndex, addressRegisterIndex, immediate);

      assert.deepStrictEqual(registers.getU64(resultRegisterIndex), expectedValue);
      assert.deepStrictEqual(registers.getI64(resultRegisterIndex), expectedValue);
    });

    it("should load u64 from memory to register", () => {
      const address = tryAsMemoryIndex(1 + RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);
      const data = new Uint8Array([0x11, 0x11, 0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa, 0x99, 0x08]);
      const { loadOps, registers, resultRegisterIndex, addressRegisterIndex, immediate } = prepareLoadIndData(
        address,
        data,
        1n + 16n * BigInt(PAGE_SIZE),
        1n,
      );
      const expectedValue = 619714147312856831n;

      loadOps.loadIndU64(resultRegisterIndex, addressRegisterIndex, immediate);

      assert.deepStrictEqual(registers.getU64(resultRegisterIndex), expectedValue);
      assert.deepStrictEqual(registers.getI64(resultRegisterIndex), expectedValue);
    });

    it("should load u64 from memory to register (negative number)", () => {
      const address = tryAsMemoryIndex(1 + RESERVED_NUMBER_OF_PAGES * PAGE_SIZE);
      const data = new Uint8Array([0x11, 0x11, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
      const { loadOps, registers, resultRegisterIndex, addressRegisterIndex, immediate } = prepareLoadIndData(
        address,
        data,
        1n + 16n * BigInt(PAGE_SIZE),
        1n,
      );
      const expectedSignedValue = -1n;
      const expectedUnsignedValue = 2n ** 64n - 1n;

      loadOps.loadIndU64(resultRegisterIndex, addressRegisterIndex, immediate);

      assert.deepStrictEqual(registers.getU64(resultRegisterIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(resultRegisterIndex), expectedSignedValue);
    });
  });
});
