import type { Mask } from "./program-decoder/mask";
import type { Registers } from "./registers";

export class Context {
  constructor(
    public code: Uint8Array,
    public mask: Mask,
    public regs: Registers,
    public pc: number,
  ) {}
}
