import type { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import type { InstructionResult } from "../instruction-result";
import type { Memory } from "../memory";
import { tryAsMemoryIndex } from "../memory/memory-index";
import { type Registers, signExtend32To64 } from "../registers";
import { Result } from "../result";
import { addWithOverflowU32 } from "./math-utils";

const REG_SIZE_BYTES = 8;

export class LoadOps {
  constructor(
    private regs: Registers,
    private memory: Memory,
    private instructionResult: InstructionResult,
  ) {}

  loadImmediate(registerIndex: number, immediate: number) {
    this.regs.setU64(registerIndex, signExtend32To64(immediate));
  }

  loadImmediateU64(registerIndex: number, immediate: bigint) {
    this.regs.setU64(registerIndex, immediate);
  }

  private loadNumber(address: number, registerIndex: number, numberLength: 1 | 2 | 4 | 8) {
    const registerBytes = this.regs.getBytesAsLittleEndian(registerIndex, REG_SIZE_BYTES);
    const loadResult = this.memory.loadInto(registerBytes.subarray(0, numberLength), tryAsMemoryIndex(address));
    if (loadResult !== null) {
      this.instructionResult.status = Result.FAULT;
      this.instructionResult.exitParam = address;
    }

    registerBytes.fill(0, numberLength);
  }

  private loadSignedNumber(address: number, registerIndex: number, numberLength: 1 | 2 | 4) {
    // load all bytes from register to correctly handle the sign.
    const registerBytes = this.regs.getBytesAsLittleEndian(registerIndex, REG_SIZE_BYTES);
    const loadResult = this.memory.loadInto(registerBytes.subarray(0, numberLength), tryAsMemoryIndex(address));
    if (loadResult !== null) {
      this.instructionResult.status = Result.FAULT;
      this.instructionResult.exitParam = address;
      return;
    }

    const msb = registerBytes[numberLength - 1] & 0x80;
    if (msb > 0) {
      registerBytes.fill(0xff, numberLength);
    } else {
      registerBytes.fill(0x00, numberLength);
    }
  }

  loadU8(address: number, registerIndex: number) {
    this.loadNumber(address, registerIndex, 1);
  }

  loadU16(address: number, registerIndex: number) {
    this.loadNumber(address, registerIndex, 2);
  }

  loadU32(address: number, registerIndex: number) {
    this.loadNumber(address, registerIndex, 4);
  }

  loadU64(address: number, registerIndex: number) {
    this.loadNumber(address, registerIndex, 8);
  }

  loadI8(address: number, registerIndex: number) {
    this.loadSignedNumber(address, registerIndex, 1);
  }

  loadI16(address: number, registerIndex: number) {
    this.loadSignedNumber(address, registerIndex, 2);
  }

  loadI32(address: number, registerIndex: number) {
    this.loadSignedNumber(address, registerIndex, 4);
  }

  loadIndU8(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = addWithOverflowU32(this.regs.getU32(firstRegisterIndex), immediateDecoder.getUnsigned());
    this.loadNumber(address, secondRegisterIndex, 1);
  }

  loadIndU16(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = addWithOverflowU32(this.regs.getU32(firstRegisterIndex), immediateDecoder.getUnsigned());
    this.loadNumber(address, secondRegisterIndex, 2);
  }

  loadIndU32(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = addWithOverflowU32(this.regs.getU32(firstRegisterIndex), immediateDecoder.getUnsigned());
    this.loadNumber(address, secondRegisterIndex, 4);
  }

  loadIndU64(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = addWithOverflowU32(this.regs.getU32(firstRegisterIndex), immediateDecoder.getUnsigned());
    this.loadNumber(address, secondRegisterIndex, 8);
  }

  loadIndI8(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = addWithOverflowU32(this.regs.getU32(firstRegisterIndex), immediateDecoder.getUnsigned());
    this.loadSignedNumber(address, secondRegisterIndex, 1);
  }

  loadIndI16(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = addWithOverflowU32(this.regs.getU32(firstRegisterIndex), immediateDecoder.getUnsigned());
    this.loadSignedNumber(address, secondRegisterIndex, 2);
  }

  loadIndI32(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = addWithOverflowU32(this.regs.getU32(firstRegisterIndex), immediateDecoder.getUnsigned());
    this.loadSignedNumber(address, secondRegisterIndex, 4);
  }
}
