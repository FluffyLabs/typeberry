import type { Memory } from "../memory";
import type { Registers } from "../registers";

export class LoadOps {
  constructor(
    private regs: Registers,
    private memory: Memory,
  ) {}

  loadImmediate(registerIndex: number, immediate: number) {
    this.regs.asUnsigned[registerIndex] = immediate;
  }

  private loadNumber(address: number, registerIndex: number, numberLength: 1 | 2 | 4) {
    const bytes = this.memory.load(address, numberLength);

    if (bytes) {
      this.regs.setFromBytes(registerIndex, bytes);
    } else {
      // TODO [MaSi]: it should be a page fault
    }
  }

  private loadSignedNumber(address: number, registerIndex: number, numberLength: 1 | 2) {
    const bytes = this.memory.load(address, numberLength);
    if (bytes) {
      const msb = bytes[numberLength - 1] & 0x80;
      if (msb > 0) {
        const result = new Uint8Array(4);
        result.fill(0xff);
        result.set(bytes, 0);
        this.regs.setFromBytes(registerIndex, result);
      } else {
        this.regs.setFromBytes(registerIndex, bytes);
      }
    } else {
      // TODO [MaSi]: it should be a page fault
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
}
