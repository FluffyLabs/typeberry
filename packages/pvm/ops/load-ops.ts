import type { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import type { InstructionResult } from "../instruction-result";
import type { Memory } from "../memory";
import type { Registers } from "../registers";
import { Result } from "../result";

export class LoadOps {
  constructor(
    private regs: Registers,
    private memory: Memory,
    private instructionResult: InstructionResult,
  ) {}

  loadImmediate(registerIndex: number, immediate: number) {
    this.regs.asUnsigned[registerIndex] = immediate;
  }

  private loadNumber(address: number, registerIndex: number, numberLength: 1 | 2 | 4) {
    if (!this.memory.isReadable(address)) {
      this.instructionResult.status = Result.FAULT;
      this.instructionResult.exitParam = address;
      return;
    }
    const bytes = this.memory.load(address, numberLength);

    this.regs.setFromBytes(registerIndex, bytes);
  }

  private loadSignedNumber(address: number, registerIndex: number, numberLength: 1 | 2) {
    if (!this.memory.isReadable(address)) {
      this.instructionResult.status = Result.FAULT;
      this.instructionResult.exitParam = address;
      return;
    }
    const bytes = this.memory.load(address, numberLength);
    const msb = bytes[numberLength - 1] & 0x80;
    if (msb > 0) {
      const result = new Uint8Array(4);
      result.fill(0xff);
      result.set(bytes, 0);
      this.regs.setFromBytes(registerIndex, result);
    } else {
      this.regs.setFromBytes(registerIndex, bytes);
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

  loadI8(address: number, registerIndex: number) {
    this.loadSignedNumber(address, registerIndex, 1);
  }

  loadI16(address: number, registerIndex: number) {
    this.loadSignedNumber(address, registerIndex, 2);
  }

  loadIndU8(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = this.regs.asUnsigned[firstRegisterIndex] + immediateDecoder.getUnsigned();
    this.loadNumber(address, secondRegisterIndex, 1);
  }

  loadIndU16(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = this.regs.asUnsigned[firstRegisterIndex] + immediateDecoder.getUnsigned();
    this.loadNumber(address, secondRegisterIndex, 2);
  }

  loadIndU32(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = this.regs.asUnsigned[firstRegisterIndex] + immediateDecoder.getUnsigned();
    this.loadNumber(address, secondRegisterIndex, 4);
  }

  loadIndI8(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = this.regs.asUnsigned[firstRegisterIndex] + immediateDecoder.getUnsigned();
    this.loadSignedNumber(address, secondRegisterIndex, 1);
  }

  loadIndI16(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = this.regs.asUnsigned[firstRegisterIndex] + immediateDecoder.getUnsigned();
    this.loadSignedNumber(address, secondRegisterIndex, 2);
  }
}
