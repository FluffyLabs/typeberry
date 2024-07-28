import type { Context } from "../context";
import { BaseOps } from "./base-ops";

export class BooleanOps extends BaseOps<Pick<Context, "regs">> {
  setLessThanSignedImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.ctx.regs.asUnsigned[resultIndex] = this.ctx.regs.asSigned[firstIndex] < immediateValue ? 1 : 0;
  }

  setLessThanUnsignedImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.ctx.regs.asUnsigned[resultIndex] = this.ctx.regs.asUnsigned[firstIndex] < immediateValue ? 1 : 0;
  }

  setLessThanSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.setLessThanSignedImmediate(secondIndex, this.ctx.regs.asSigned[firstIndex], resultIndex);
  }

  setLessThanUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.setLessThanUnsignedImmediate(secondIndex, this.ctx.regs.asUnsigned[firstIndex], resultIndex);
  }

  setGreaterThanSignedImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.ctx.regs.asUnsigned[resultIndex] = this.ctx.regs.asSigned[firstIndex] > immediateValue ? 1 : 0;
  }

  setGreaterThanUnsignedImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.ctx.regs.asUnsigned[resultIndex] = this.ctx.regs.asUnsigned[firstIndex] > immediateValue ? 1 : 0;
  }
}
