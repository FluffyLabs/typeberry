import assert from "node:assert";
import { describe, it } from "node:test";

import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { InstructionResult } from "../instruction-result";
import { Memory, MemoryBuilder } from "../memory";
import { PAGE_SIZE } from "../memory/memory-consts";
import { tryAsMemoryIndex, tryAsSbrkIndex } from "../memory/memory-index";
import { getStartPageIndex } from "../memory/memory-utils";
import { Registers } from "../registers";
import { bigintToUint8ArrayLE } from "../test-utils";
import { LoadOps } from "./load-ops";

const RESULT_REGISTER = 12;

describe("LoadOps", () => {
  describe("loadImmediate", () => {
    function prepareData(numberToLoad: bigint) {
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
      const { resultRegister, loadOps, registers, immediateDecoder } = prepareData(numberToLoad);

      loadOps.loadImmediate(resultRegister, immediateDecoder);

      assert.strictEqual(registers.getI64(RESULT_REGISTER), numberToLoad);
      assert.strictEqual(registers.getU64(RESULT_REGISTER), numberToLoad);
    });

    it("should load negative number into register", () => {
      const numberToLoad = -1n;
      const { resultRegister, loadOps, registers, immediateDecoder } = prepareData(numberToLoad);
      const expectedUnsignedNumber = 2n ** 64n - 1n;

      loadOps.loadImmediate(resultRegister, immediateDecoder);

      assert.strictEqual(registers.getI64(RESULT_REGISTER), numberToLoad);
      assert.strictEqual(registers.getU64(RESULT_REGISTER), expectedUnsignedNumber);
    });
  });

  describe("load (U8, U16, U32 and U64)", () => {
    it("should load u8 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);

      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0xff, 0xee, 0xdd, 0xcc]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedValue = 0xffn;
      const registerIndex = 0;

      loadOps.loadU8(address, registerIndex);

      assert.deepStrictEqual(registers.getI64(registerIndex), expectedValue);
      assert.deepStrictEqual(registers.getU64(registerIndex), expectedValue);
    });

    it("should load u8 from memory to register and extend the number to the register size", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);

      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0xff, 0xee, 0xdd, 0xcc]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedValue = 0xffn;
      const registerIndex = 0;
      registers.setU32(registerIndex, 0x11_22_33_44);

      loadOps.loadU8(address, registerIndex);

      assert.deepStrictEqual(registers.getI64(registerIndex), expectedValue);
      assert.deepStrictEqual(registers.getU64(registerIndex), expectedValue);
    });

    it("should load u16 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0xff, 0xee, 0xdd, 0xcc]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedValue = 61183n;
      const registerIndex = 0;

      loadOps.loadU16(address, registerIndex);

      assert.deepStrictEqual(registers.getI64(registerIndex), expectedValue);
      assert.deepStrictEqual(registers.getU64(registerIndex), expectedValue);
    });

    it("should load u16 from memory to register and extend the number to the register size", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0xff, 0xee, 0xdd, 0xcc]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedValue = 61183n;
      const registerIndex = 0;
      registers.setU32(registerIndex, 0x11_22_33_44);

      loadOps.loadU16(address, registerIndex);

      assert.deepStrictEqual(registers.getI64(registerIndex), expectedValue);
      assert.deepStrictEqual(registers.getU64(registerIndex), expectedValue);
    });

    it("should load u32 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0xff, 0xee, 0xdd, 0x0c]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedValue = 215871231n;
      const registerIndex = 0;

      loadOps.loadU32(address, registerIndex);

      assert.deepStrictEqual(registers.getI64(registerIndex), expectedValue);
      assert.deepStrictEqual(registers.getU64(registerIndex), expectedValue);
    });

    it("should load u32 from memory to register and extend the number to the register size", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0xff, 0xee, 0xdd, 0x0c]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedValue = 215871231n;
      const registerIndex = 0;
      registers.setU64(registerIndex, 0x11_22_33_44_55_66_77_88n);

      loadOps.loadU32(address, registerIndex);

      assert.deepStrictEqual(registers.getI64(registerIndex), expectedValue);
      assert.deepStrictEqual(registers.getU64(registerIndex), expectedValue);
    });

    it("should load u64 from memory to register (negative number)", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -1n;
      const expectedUnsignedValue = 2n ** 64n - 1n;
      const registerIndex = 0;

      loadOps.loadU64(address, registerIndex);

      assert.deepStrictEqual(registers.getI64(registerIndex), expectedSignedValue);
      assert.deepStrictEqual(registers.getU64(registerIndex), expectedUnsignedValue);
    });

    it("should load u64 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa, 0x99, 0x08]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedValue = 0x08_99_aa_bb_cc_dd_ee_ffn;
      const registerIndex = 0;

      loadOps.loadU64(address, registerIndex);

      assert.deepStrictEqual(registers.getI64(registerIndex), expectedValue);
      assert.deepStrictEqual(registers.getU64(registerIndex), expectedValue);
    });
  });

  describe("load (I8, I16 and I32)", () => {
    it("should load i8 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0xcc, 0xff, 0xff, 0xff]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -52n;
      const expectedUnsignedValue = 18446744073709551564n;
      const registerIndex = 0;

      loadOps.loadI8(address, registerIndex);

      assert.deepStrictEqual(registers.getU64(registerIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(registerIndex), expectedSignedValue);
    });

    it("should load i8 from memory to register and extend the number to the register size", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0xcc, 0xff, 0xff, 0xff]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -52n;
      const expectedUnsignedValue = 18446744073709551564n;
      const registerIndex = 0;
      registers.setU64(registerIndex, 0x11_22_33_44_55_66_77_88n);

      loadOps.loadI8(address, registerIndex);

      assert.deepStrictEqual(registers.getU64(registerIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(registerIndex), expectedSignedValue);
    });

    it("should load i16 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0xcc, 0xdd, 0xff, 0xff]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -8756n;
      const expectedUnsignedValue = 18446744073709542860n;
      const registerIndex = 0;

      loadOps.loadI16(address, registerIndex);

      assert.deepStrictEqual(registers.getU64(registerIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(registerIndex), expectedSignedValue);
    });

    it("should load i16 from memory to register and extend the number to the register size", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0xcc, 0xdd, 0xff, 0xff]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -8756n;
      const expectedUnsignedValue = 18446744073709542860n;
      const registerIndex = 0;
      registers.setU64(registerIndex, 0x11_22_33_44_55_66_77_88n);

      loadOps.loadI16(address, registerIndex);

      assert.deepStrictEqual(registers.getU64(registerIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(registerIndex), expectedSignedValue);
    });

    it("should load i32 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0xcc, 0xdd, 0xff, 0xff]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -8756n;
      const expectedUnsignedValue = 18446744073709542860n;
      const registerIndex = 0;

      loadOps.loadI32(address, registerIndex);

      assert.deepStrictEqual(registers.getU64(registerIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(registerIndex), expectedSignedValue);
    });

    it("should load i32 from memory to register and extend the number to the register size", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0xcc, 0xdd, 0xff, 0xff]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -8756n;
      const expectedUnsignedValue = 18446744073709542860n;
      const registerIndex = 0;
      registers.setU64(registerIndex, 0x11_22_33_44_55_66_77_88n);

      loadOps.loadI32(address, registerIndex);

      assert.deepStrictEqual(registers.getU64(registerIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(registerIndex), expectedSignedValue);
    });
  });

  describe("loadInd (I8 I16 and I32)", () => {
    it("should load i8 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const registers = new Registers();
      const address = tryAsMemoryIndex(2);
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.setU32(firstRegisterIndex, 1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0x11, 0xcc, 0xff, 0xff, 0xff]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -52n;
      const expectedUnsignedValue = 18446744073709551564n;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));

      loadOps.loadIndI8(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.getU64(secondRegisterIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(secondRegisterIndex), expectedSignedValue);
    });

    it("should load i8 from memory to register and extend the number to the register size", () => {
      const instructionResult = new InstructionResult();
      const registers = new Registers();
      const address = tryAsMemoryIndex(1);
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.setU32(firstRegisterIndex, 1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0x11, 0xcc, 0xff, 0xff, 0xff]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -52n;
      const expectedUnsignedValue = 18446744073709551564n;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      registers.setU64(secondRegisterIndex, 0x11_22_33_44_55_66_77_88n);

      loadOps.loadIndI8(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.getU64(secondRegisterIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(secondRegisterIndex), expectedSignedValue);
    });

    it("should load i16 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const registers = new Registers();
      const address = tryAsMemoryIndex(1);
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.setU32(firstRegisterIndex, 1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0x11, 0xcc, 0xdd, 0xff, 0xff]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -8756n;
      const expectedUnsignedValue = 18446744073709542860n;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));

      loadOps.loadIndI16(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.getU64(secondRegisterIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(secondRegisterIndex), expectedSignedValue);
    });

    it("should load i16 from memory to register and extend the number to the register size", () => {
      const instructionResult = new InstructionResult();
      const registers = new Registers();
      const address = tryAsMemoryIndex(1);
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.setU32(firstRegisterIndex, 1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0x11, 0xcc, 0xdd, 0xff, 0xff]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -8756n;
      const expectedUnsignedValue = 18446744073709542860n;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      registers.setU64(secondRegisterIndex, 0x11_22_33_44_55_66_77_88n);

      loadOps.loadIndI16(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.getU64(secondRegisterIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(secondRegisterIndex), expectedSignedValue);
    });

    it("should load i32 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const registers = new Registers();
      const address = tryAsMemoryIndex(1);
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.setU32(firstRegisterIndex, 1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0x11, 0xcc, 0xdd, 0xff, 0xff]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -8756n;
      const expectedUnsignedValue = 18446744073709542860n;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));

      loadOps.loadIndI32(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.getU64(secondRegisterIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(secondRegisterIndex), expectedSignedValue);
    });

    it("should load i32 from memory to register and extend the number to the register size", () => {
      const instructionResult = new InstructionResult();
      const registers = new Registers();
      const address = tryAsMemoryIndex(1);
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.setU32(firstRegisterIndex, 1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0x11, 0xcc, 0xdd, 0xff, 0xff]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -8756n;
      const expectedUnsignedValue = 18446744073709542860n;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      registers.setU64(secondRegisterIndex, 0x11_22_33_44_55_66_77_88n);

      loadOps.loadIndI32(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.getU64(secondRegisterIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(secondRegisterIndex), expectedSignedValue);
    });
  });

  describe("loadInd (U8, U16 and U32)", () => {
    it("should load u8 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0x11, 0xff, 0xee, 0xdd, 0xcc]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.setU32(firstRegisterIndex, 1);
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const expectedValue = 0xffn;

      loadOps.loadIndU8(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.getU64(secondRegisterIndex), expectedValue);
      assert.deepStrictEqual(registers.getI64(secondRegisterIndex), expectedValue);
    });

    it("should load u8 from memory to register and extend the number to the register size", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0x11, 0xff, 0xee, 0xdd, 0xcc]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.setU32(firstRegisterIndex, 1);
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const expectedValue = 0xffn;
      registers.setU64(secondRegisterIndex, 0x11_22_33_44_55_66_77_88n);

      loadOps.loadIndU8(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.getU64(secondRegisterIndex), expectedValue);
      assert.deepStrictEqual(registers.getI64(secondRegisterIndex), expectedValue);
    });

    it("should load u16 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0x11, 0xff, 0xee, 0xdd, 0xcc]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.setU32(firstRegisterIndex, 1);
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const expectedValue = 61183n;

      loadOps.loadIndU16(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.getU64(secondRegisterIndex), expectedValue);
      assert.deepStrictEqual(registers.getI64(secondRegisterIndex), expectedValue);
    });

    it("should load u16 from memory to register and extend the number to the register size", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0x11, 0xff, 0xee, 0xdd, 0xcc]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.setU32(firstRegisterIndex, 1);
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const expectedValue = 61183n;
      registers.setU64(secondRegisterIndex, 0x11_22_33_44_55_66_77_88n);

      loadOps.loadIndU16(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.getU64(secondRegisterIndex), expectedValue);
      assert.deepStrictEqual(registers.getI64(secondRegisterIndex), expectedValue);
    });

    it("should load u32 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0x11, 0xff, 0xee, 0xdd, 0x0c]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.setU32(firstRegisterIndex, 1);
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const expectedValue = 215871231n;

      loadOps.loadIndU32(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.getU64(secondRegisterIndex), expectedValue);
      assert.deepStrictEqual(registers.getI64(secondRegisterIndex), expectedValue);
    });

    it("should load u32 from memory to register and extend the number to the register size", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0x11, 0xff, 0xee, 0xdd, 0x0c]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.setU32(firstRegisterIndex, 1);
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const expectedValue = 215871231n;
      registers.setU64(secondRegisterIndex, 0x11_22_33_44_55_66_77_88n);

      loadOps.loadIndU32(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.getU64(secondRegisterIndex), expectedValue);
      assert.deepStrictEqual(registers.getI64(secondRegisterIndex), expectedValue);
    });

    it("should load u64 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0x11, 0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa, 0x99, 0x08]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.setU32(firstRegisterIndex, 1);
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const expectedValue = 619714147312856831n;

      loadOps.loadIndU64(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.getU64(secondRegisterIndex), expectedValue);
      assert.deepStrictEqual(registers.getI64(secondRegisterIndex), expectedValue);
    });

    it("should load u64 from memory to register (negative number)", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);

      const memory = new MemoryBuilder()
        .setWriteablePages(
          getStartPageIndex(address),
          tryAsMemoryIndex(4096),
          new Uint8Array([0x11, 0x11, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
        )
        .finalize(tryAsSbrkIndex(PAGE_SIZE), tryAsSbrkIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.setU32(firstRegisterIndex, 1);
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const expectedSignedValue = -1n;
      const expectedUnsignedValue = 2n ** 64n - 1n;

      loadOps.loadIndU64(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.getU64(secondRegisterIndex), expectedUnsignedValue);
      assert.deepStrictEqual(registers.getI64(secondRegisterIndex), expectedSignedValue);
    });
  });
});
