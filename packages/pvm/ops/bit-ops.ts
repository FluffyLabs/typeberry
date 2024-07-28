import type { Context } from "../context";
import { BaseOps } from "./base-ops";

export class BitOps extends BaseOps<Pick<Context, "regs">> {
  or(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.orImmediate(firstIndex, this.ctx.regs.asUnsigned[secondIndex], resultIndex);
  }

  orImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.ctx.regs.asUnsigned[resultIndex] = this.ctx.regs.asUnsigned[firstIndex] | immediateValue;
  }

  and(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.andImmediate(firstIndex, this.ctx.regs.asUnsigned[secondIndex], resultIndex);
  }

  andImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.ctx.regs.asUnsigned[resultIndex] = this.ctx.regs.asUnsigned[firstIndex] & immediateValue;
  }

  xor(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.xorImmediate(firstIndex, this.ctx.regs.asUnsigned[secondIndex], resultIndex);
  }

  xorImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.ctx.regs.asUnsigned[resultIndex] = this.ctx.regs.asUnsigned[firstIndex] ^ immediateValue;
  }
}
