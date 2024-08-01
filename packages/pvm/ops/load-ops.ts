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

  loadU8(address: number, registerIndex: number) {
    this.loadNumber(address, registerIndex, 1);
  }

  loadU16(address: number, registerIndex: number) {
    this.loadNumber(address, registerIndex, 2);
  }

  loadU32(address: number, registerIndex: number) {
    this.loadNumber(address, registerIndex, 4);
  }
}
