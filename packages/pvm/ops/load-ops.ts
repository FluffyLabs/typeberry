import type { Context } from "../context";
import { BaseOps } from "./base-ops";

export class LoadOps extends BaseOps<Pick<Context, "regs">> {
  loadImmediate(registerIndex: number, immediate: number) {
    this.ctx.regs.asUnsigned[registerIndex] = immediate;
  }
}
