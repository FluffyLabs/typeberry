import { BaseOps } from "./base-ops";

export class LoadOps extends BaseOps<"regs"> {
  loadImmediate(registerIndex: number, immediate: number) {
    this.context.regs.asUnsigned[registerIndex] = immediate;
  }
}
