import { BaseOps } from "./base-ops";

export class BitOps extends BaseOps<"regs"> {
  or(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.orImmediate(firstIndex, this.context.regs.asUnsigned[secondIndex], resultIndex);
  }

  orImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.context.regs.asUnsigned[resultIndex] = this.context.regs.asUnsigned[firstIndex] | immediateValue;
  }

  and(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.andImmediate(firstIndex, this.context.regs.asUnsigned[secondIndex], resultIndex);
  }

  andImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.context.regs.asUnsigned[resultIndex] = this.context.regs.asUnsigned[firstIndex] & immediateValue;
  }

  xor(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.xorImmediate(firstIndex, this.context.regs.asUnsigned[secondIndex], resultIndex);
  }

  xorImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.context.regs.asUnsigned[resultIndex] = this.context.regs.asUnsigned[firstIndex] ^ immediateValue;
  }
}
