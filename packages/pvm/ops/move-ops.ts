import type { Context } from "../context";
import { BaseOps } from "./base-ops";

export class MoveOps extends BaseOps<Pick<Context, "regs">> {
  cmovIfZeroImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    if (this.ctx.regs.asUnsigned[firstIndex] === 0) {
      this.ctx.regs.asUnsigned[resultIndex] = immediateValue;
    }
  }

  cmovIfNotZeroImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    if (this.ctx.regs.asUnsigned[firstIndex] !== 0) {
      this.ctx.regs.asUnsigned[resultIndex] = immediateValue;
    }
  }

  cmovIfZero(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.cmovIfZeroImmediate(firstIndex, this.ctx.regs.asUnsigned[secondIndex], resultIndex);
  }

  cmovIfNotZero(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.cmovIfNotZeroImmediate(firstIndex, this.ctx.regs.asUnsigned[secondIndex], resultIndex);
  }

  moveRegister(firstIndex: number, resultIndex: number) {
    this.ctx.regs.asUnsigned[resultIndex] = this.ctx.regs.asUnsigned[firstIndex];
  }
}
