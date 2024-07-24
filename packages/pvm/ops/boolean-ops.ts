import { BaseOps } from "./base-ops";

export class BooleanOps extends BaseOps<"regs"> {
  setLessThanSignedImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.context.regs.asUnsigned[resultIndex] = this.context.regs.asSigned[firstIndex] < immediateValue ? 1 : 0;
  }

  setLessThanUnsignedImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.context.regs.asUnsigned[resultIndex] = this.context.regs.asUnsigned[firstIndex] < immediateValue ? 1 : 0;
  }

  setLessThanSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.setLessThanSignedImmediate(secondIndex, this.context.regs.asSigned[firstIndex], resultIndex);
  }

  setLessThanUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.setLessThanUnsignedImmediate(secondIndex, this.context.regs.asUnsigned[firstIndex], resultIndex);
  }

  setGreaterThanSignedImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.context.regs.asUnsigned[resultIndex] = this.context.regs.asSigned[firstIndex] > immediateValue ? 1 : 0;
  }

  setGreaterThanUnsignedImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.context.regs.asUnsigned[resultIndex] = this.context.regs.asUnsigned[firstIndex] > immediateValue ? 1 : 0;
  }
}
