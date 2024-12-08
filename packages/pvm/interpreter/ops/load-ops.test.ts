import assert from "node:assert";
import { describe, it } from "node:test";

import { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { InstructionResult } from "../instruction-result";
import { Memory, MemoryBuilder } from "../memory";
import { PAGE_SIZE } from "../memory/memory-consts";
import { tryAsMemoryIndex } from "../memory/memory-index";
import { Registers } from "../registers";
import { LoadOps } from "./load-ops";

const RESULT_REGISTER = 12;

describe("LoadOps", () => {
  describe("loadImmediate", () => {
    it("should load positive number into register", () => {
      const instructionResult = new InstructionResult();
      const registers = new Registers();
      const memory = new Memory();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const numberToLoad = 15;

      loadOps.loadImmediate(RESULT_REGISTER, numberToLoad);

      assert.strictEqual(registers.asSigned[RESULT_REGISTER], numberToLoad);
      assert.strictEqual(registers.asUnsigned[RESULT_REGISTER], numberToLoad);
    });

    it("should load negative number into register", () => {
      const instructionResult = new InstructionResult();
      const registers = new Registers();
      const memory = new Memory();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const numberToLoad = -1;
      const expectedUnsignedNumber = 0xff_ff_ff_ff;

      loadOps.loadImmediate(RESULT_REGISTER, numberToLoad);

      assert.strictEqual(registers.asSigned[RESULT_REGISTER], numberToLoad);
      assert.strictEqual(registers.asUnsigned[RESULT_REGISTER], expectedUnsignedNumber);
    });
  });

  describe("load (U8, U16 and U32)", () => {
    it("should load u8 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);

      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xff, 0xee, 0xdd, 0xcc]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedValue = 0xff;
      const registerIndex = 0;

      loadOps.loadU8(address, registerIndex);

      assert.deepStrictEqual(registers.asSigned[registerIndex], expectedValue);
      assert.deepStrictEqual(registers.asUnsigned[registerIndex], expectedValue);
    });

    it("should load u8 from memory to register and fill the rest of bytes with zeros", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);

      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xff, 0xee, 0xdd, 0xcc]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedValue = 0xff;
      const registerIndex = 0;
      registers.asUnsigned[registerIndex] = 0x11_22_33_44;

      loadOps.loadU8(address, registerIndex);

      assert.deepStrictEqual(registers.asSigned[registerIndex], expectedValue);
      assert.deepStrictEqual(registers.asUnsigned[registerIndex], expectedValue);
    });

    it("should load u16 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xff, 0xee, 0xdd, 0xcc]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedValue = 61183;
      const registerIndex = 0;

      loadOps.loadU16(address, registerIndex);

      assert.deepStrictEqual(registers.asSigned[registerIndex], expectedValue);
      assert.deepStrictEqual(registers.asUnsigned[registerIndex], expectedValue);
    });

    it("should load u16 from memory to register and fill the rest of bytes with zeros", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xff, 0xee, 0xdd, 0xcc]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedValue = 61183;
      const registerIndex = 0;
      registers.asUnsigned[registerIndex] = 0x11_22_33_44;

      loadOps.loadU16(address, registerIndex);

      assert.deepStrictEqual(registers.asSigned[registerIndex], expectedValue);
      assert.deepStrictEqual(registers.asUnsigned[registerIndex], expectedValue);
    });

    it("should load u32 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xff, 0xee, 0xdd, 0x0c]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedValue = 215871231;
      const registerIndex = 0;

      loadOps.loadU32(address, registerIndex);

      assert.deepStrictEqual(registers.asSigned[registerIndex], expectedValue);
      assert.deepStrictEqual(registers.asUnsigned[registerIndex], expectedValue);
    });

    it("should load u32 from memory to register (negative number)", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xff, 0xff, 0xff, 0xff]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
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
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xcc, 0xff, 0xff, 0xff]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -52;
      const expectedUnsignedValue = 4294967244;
      const registerIndex = 0;

      loadOps.loadI8(address, registerIndex);

      assert.deepStrictEqual(registers.asSigned[registerIndex], expectedSignedValue);
      assert.deepStrictEqual(registers.asUnsigned[registerIndex], expectedUnsignedValue);
    });

    it("should load i8 from memory to register and fill the rest of bytes with zeros", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xcc, 0xff, 0xff, 0xff]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -52;
      const expectedUnsignedValue = 4294967244;
      const registerIndex = 0;
      registers.asUnsigned[registerIndex] = 0x11_22_33_44;

      loadOps.loadI8(address, registerIndex);

      assert.deepStrictEqual(registers.asSigned[registerIndex], expectedSignedValue);
      assert.deepStrictEqual(registers.asUnsigned[registerIndex], expectedUnsignedValue);
    });

    it("should load i16 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xcc, 0xdd, 0xff, 0xff]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -8756;
      const expectedUnsignedValue = 0xffffddcc;
      const registerIndex = 0;

      loadOps.loadI16(address, registerIndex);

      assert.deepStrictEqual(registers.asUnsigned[registerIndex], expectedUnsignedValue);
      assert.deepStrictEqual(registers.asSigned[registerIndex], expectedSignedValue);
    });

    it("should load i16 from memory to register and fill the rest of bytes with zeros", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(1);
      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xcc, 0xdd, 0xff, 0xff]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -8756;
      const expectedUnsignedValue = 0xffffddcc;
      const registerIndex = 0;
      registers.asUnsigned[registerIndex] = 0x11_22_33_44;

      loadOps.loadI16(address, registerIndex);

      assert.deepStrictEqual(registers.asUnsigned[registerIndex], expectedUnsignedValue);
      assert.deepStrictEqual(registers.asSigned[registerIndex], expectedSignedValue);
    });
  });

  describe("loadInd (I8 and I16)", () => {
    it("should load i8 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const registers = new Registers();
      const address = tryAsMemoryIndex(2);
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.asUnsigned[firstRegisterIndex] = 1;
      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xcc, 0xff, 0xff, 0xff]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -52;
      const expectedUnsignedValue = 4294967244;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));

      loadOps.loadIndI8(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.asSigned[secondRegisterIndex], expectedSignedValue);
      assert.deepStrictEqual(registers.asUnsigned[secondRegisterIndex], expectedUnsignedValue);
    });

    it("should load i8 from memory to register and fill the rest of bytes with zeros", () => {
      const instructionResult = new InstructionResult();
      const registers = new Registers();
      const address = tryAsMemoryIndex(2);
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.asUnsigned[firstRegisterIndex] = 1;
      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xcc, 0xff, 0xff, 0xff]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -52;
      const expectedUnsignedValue = 4294967244;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      registers.asUnsigned[secondRegisterIndex] = 0x11_22_33_44;

      loadOps.loadIndI8(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.asSigned[secondRegisterIndex], expectedSignedValue);
      assert.deepStrictEqual(registers.asUnsigned[secondRegisterIndex], expectedUnsignedValue);
    });

    it("should load i16 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const registers = new Registers();
      const address = tryAsMemoryIndex(2);
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.asUnsigned[firstRegisterIndex] = 1;
      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xcc, 0xdd, 0xff, 0xff]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -8756;
      const expectedUnsignedValue = 4294958540;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));

      loadOps.loadIndI16(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.asSigned[secondRegisterIndex], expectedSignedValue);
      assert.deepStrictEqual(registers.asUnsigned[secondRegisterIndex], expectedUnsignedValue);
    });

    it("should load i16 from memory to register and fill the rest of bytes with zeros", () => {
      const instructionResult = new InstructionResult();
      const registers = new Registers();
      const address = tryAsMemoryIndex(2);
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.asUnsigned[firstRegisterIndex] = 1;
      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xcc, 0xdd, 0xff, 0xff]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const expectedSignedValue = -8756;
      const expectedUnsignedValue = 4294958540;
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      registers.asUnsigned[secondRegisterIndex] = 0x11_22_33_44;

      loadOps.loadIndI16(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.asSigned[secondRegisterIndex], expectedSignedValue);
      assert.deepStrictEqual(registers.asUnsigned[secondRegisterIndex], expectedUnsignedValue);
    });
  });

  describe("loadInd (U8, U16 and U32)", () => {
    it("should load u8 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(2);
      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xff, 0xee, 0xdd, 0xcc]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.asUnsigned[firstRegisterIndex] = 1;
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const expectedValue = 0xff;

      loadOps.loadIndU8(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.asSigned[secondRegisterIndex], expectedValue);
      assert.deepStrictEqual(registers.asUnsigned[secondRegisterIndex], expectedValue);
    });

    it("should load u8 from memory to register and fill the rest of bytes with zeros", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(2);
      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xff, 0xee, 0xdd, 0xcc]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.asUnsigned[firstRegisterIndex] = 1;
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const expectedValue = 0xff;
      registers.asUnsigned[secondRegisterIndex] = 0x11_22_33_44;

      loadOps.loadIndU8(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.asSigned[secondRegisterIndex], expectedValue);
      assert.deepStrictEqual(registers.asUnsigned[secondRegisterIndex], expectedValue);
    });

    it("should load u16 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(2);
      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xff, 0xee, 0xdd, 0xcc]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.asUnsigned[firstRegisterIndex] = 1;
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const expectedValue = 61183;

      loadOps.loadIndU16(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.asSigned[secondRegisterIndex], expectedValue);
      assert.deepStrictEqual(registers.asUnsigned[secondRegisterIndex], expectedValue);
    });

    it("should load u16 from memory to register and fill the rest of bytes with zeros", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(2);
      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xff, 0xee, 0xdd, 0xcc]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 1;
      registers.asUnsigned[firstRegisterIndex] = 1;
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const expectedValue = 61183;
      registers.asUnsigned[secondRegisterIndex] = 0x11_22_33_44;

      loadOps.loadIndU16(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.asSigned[secondRegisterIndex], expectedValue);
      assert.deepStrictEqual(registers.asUnsigned[secondRegisterIndex], expectedValue);
    });

    it("should load u32 from memory to register", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(2);
      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xff, 0xee, 0xdd, 0x0c]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 0;
      registers.asUnsigned[firstRegisterIndex] = 1;
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const expectedValue = 215871231;

      loadOps.loadIndU32(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.asSigned[secondRegisterIndex], expectedValue);
      assert.deepStrictEqual(registers.asUnsigned[secondRegisterIndex], expectedValue);
    });

    it("should load u32 from memory to register (negative number)", () => {
      const instructionResult = new InstructionResult();
      const address = tryAsMemoryIndex(2);

      const memory = new MemoryBuilder()
        .setWriteable(address, tryAsMemoryIndex(4096), new Uint8Array([0xff, 0xff, 0xff, 0xff]))
        .finalize(tryAsMemoryIndex(PAGE_SIZE), tryAsMemoryIndex(5 * PAGE_SIZE));
      const registers = new Registers();
      const firstRegisterIndex = 0;
      const secondRegisterIndex = 0;
      registers.asUnsigned[firstRegisterIndex] = 1;
      const loadOps = new LoadOps(registers, memory, instructionResult);
      const immediateDecoder = new ImmediateDecoder();
      immediateDecoder.setBytes(new Uint8Array([1]));
      const expectedSignedValue = -1;
      const expectedUnsignedValue = 2 ** 32 - 1;

      loadOps.loadIndU32(firstRegisterIndex, secondRegisterIndex, immediateDecoder);

      assert.deepStrictEqual(registers.asSigned[secondRegisterIndex], expectedSignedValue);
      assert.deepStrictEqual(registers.asUnsigned[secondRegisterIndex], expectedUnsignedValue);
    });
  });
});
