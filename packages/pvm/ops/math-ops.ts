import type { Registers } from "../registers";
import { MAX_VALUE, MIN_VALUE } from "./math-consts";
import { add, mulUnsigned, mulUpperSigned, mulUpperUnsigned, sub } from "./math-utils";

export class MathOps {
  constructor(private regs: Registers) {}

  add(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.addImmediate(firstIndex, this.regs.asUnsigned[secondIndex], resultIndex);
  }

  addImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.asUnsigned[resultIndex] = add(this.regs.asUnsigned[firstIndex], immediateValue);
  }

  mul(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.mulImmediate(firstIndex, this.regs.asUnsigned[secondIndex], resultIndex);
  }

  mulUpperUU(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.mulUpperUUImmediate(firstIndex, this.regs.asUnsigned[secondIndex], resultIndex);
  }

  mulUpperSS(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.mulUpperSSImmediate(firstIndex, this.regs.asSigned[secondIndex], resultIndex);
  }

  mulUpperSU(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.mulUpperSSImmediate(firstIndex, this.regs.asUnsigned[secondIndex], resultIndex);
  }

  mulImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.asUnsigned[resultIndex] = mulUnsigned(this.regs.asUnsigned[firstIndex], immediateValue);
  }

  mulUpperSSImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.asSigned[resultIndex] = mulUpperSigned(this.regs.asSigned[firstIndex], immediateValue);
  }

  mulUpperUUImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.asUnsigned[resultIndex] = mulUpperUnsigned(this.regs.asUnsigned[firstIndex], immediateValue);
  }

  sub(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.negAddImmediate(firstIndex, this.regs.asUnsigned[secondIndex], resultIndex);
  }

  negAddImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.asUnsigned[resultIndex] = sub(this.regs.asUnsigned[firstIndex], immediateValue);
  }

  divSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.asUnsigned[firstIndex] === 0) {
      this.regs.asUnsigned[resultIndex] = MAX_VALUE;
    } else if (this.regs.asSigned[firstIndex] === -1 && this.regs.asSigned[secondIndex] === MIN_VALUE) {
      this.regs.asUnsigned[resultIndex] = this.regs.asUnsigned[secondIndex];
    } else {
      this.regs.asSigned[resultIndex] = ~~(this.regs.asSigned[secondIndex] / this.regs.asSigned[firstIndex]);
    }
  }

  divUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.asUnsigned[firstIndex] === 0) {
      this.regs.asUnsigned[resultIndex] = MAX_VALUE;
    } else {
      this.regs.asUnsigned[resultIndex] = ~~(this.regs.asUnsigned[secondIndex] / this.regs.asUnsigned[firstIndex]);
    }
  }

  remSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.asUnsigned[firstIndex] === 0) {
      this.regs.asUnsigned[resultIndex] = this.regs.asUnsigned[secondIndex];
    } else if (this.regs.asSigned[firstIndex] === -1 && this.regs.asSigned[secondIndex] === MIN_VALUE) {
      this.regs.asUnsigned[resultIndex] = 0;
    } else {
      this.regs.asSigned[resultIndex] = this.regs.asSigned[secondIndex] % this.regs.asSigned[firstIndex];
    }
  }

  remUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.asUnsigned[firstIndex] === 0) {
      this.regs.asUnsigned[resultIndex] = this.regs.asUnsigned[secondIndex];
    } else {
      this.regs.asUnsigned[resultIndex] = this.regs.asUnsigned[secondIndex] % this.regs.asUnsigned[firstIndex];
    }
  }
}
