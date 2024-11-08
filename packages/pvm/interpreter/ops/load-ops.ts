import type { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import type { InstructionResult } from "../instruction-result";
import type { Memory } from "../memory";
import { tryAsMemoryIndex } from "../memory/memory-index";
import type { Registers } from "../registers";
import { Result } from "../result";
import { addWithOverflow } from "./math-utils";

const REG_SIZE_BYTES = 4;

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
    const registerBytes = this.regs.getBytesAsLittleEndian(registerIndex, numberLength);
    const loadResult = this.memory.loadInto(registerBytes, tryAsMemoryIndex(address));
    if (loadResult !== null) {
      this.instructionResult.status = Result.FAULT;
      this.instructionResult.exitParam = address;
    }
  }

  private loadSignedNumber(address: number, registerIndex: number, numberLength: 1 | 2) {
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
    const address = addWithOverflow(this.regs.asUnsigned[firstRegisterIndex], immediateDecoder.getUnsigned());
    this.loadNumber(address, secondRegisterIndex, 1);
  }

  loadIndU16(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = addWithOverflow(this.regs.asUnsigned[firstRegisterIndex], immediateDecoder.getUnsigned());
    this.loadNumber(address, secondRegisterIndex, 2);
  }

  loadIndU32(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = addWithOverflow(this.regs.asUnsigned[firstRegisterIndex], immediateDecoder.getUnsigned());
    this.loadNumber(address, secondRegisterIndex, 4);
  }

  loadIndI8(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = addWithOverflow(this.regs.asUnsigned[firstRegisterIndex], immediateDecoder.getUnsigned());
    this.loadSignedNumber(address, secondRegisterIndex, 1);
  }

  loadIndI16(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = addWithOverflow(this.regs.asUnsigned[firstRegisterIndex], immediateDecoder.getUnsigned());
    this.loadSignedNumber(address, secondRegisterIndex, 2);
  }
}
