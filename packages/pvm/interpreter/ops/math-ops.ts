import type { Registers } from "../registers";
import { MAX_VALUE, MIN_VALUE } from "./math-consts";
import { addWithOverflow, mulLowerUnsigned, mulUpperSigned, mulUpperUnsigned, sub } from "./math-utils";

export class MathOps {
  constructor(private regs: Registers) {}

  add(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.set(resultIndex, addWithOverflow(this.regs.get(firstIndex), this.regs.get(secondIndex)));
  }

  addImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.set(resultIndex, addWithOverflow(this.regs.get(firstIndex), immediateValue));
  }

  mul(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.set(resultIndex, mulLowerUnsigned(this.regs.get(firstIndex), this.regs.get(secondIndex)));
  }

  mulUpperUU(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.set(resultIndex, mulUpperUnsigned(this.regs.get(firstIndex), this.regs.get(secondIndex)));
  }

  mulUpperSS(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.set(resultIndex, mulUpperSigned(this.regs.get(firstIndex, true), this.regs.get(secondIndex, true)), true);
  }

  mulUpperSU(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.set(resultIndex, mulUpperSigned(this.regs.get(firstIndex, true), this.regs.get(secondIndex)), true);
  }

  mulImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.set(resultIndex, mulLowerUnsigned(this.regs.get(firstIndex), immediateValue));
  }

  mulUpperSSImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.set(resultIndex, mulUpperSigned(this.regs.get(firstIndex, true), immediateValue), true);
  }

  mulUpperUUImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.set(resultIndex, mulUpperUnsigned(this.regs.get(firstIndex), immediateValue));
  }

  sub(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.set(resultIndex, sub(this.regs.get(firstIndex), this.regs.get(secondIndex)));
  }

  negAddImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.set(resultIndex, sub(this.regs.get(firstIndex), immediateValue));
  }

  divSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.get(firstIndex) === 0) {
      this.regs.set(resultIndex, MAX_VALUE);
    } else if (this.regs.get(firstIndex, true) === -1 && this.regs.get(secondIndex, true) === MIN_VALUE) {
      this.regs.set(resultIndex, this.regs.get(secondIndex));
    } else {
      this.regs.set(resultIndex, ~~(this.regs.get(secondIndex, true) / this.regs.get(firstIndex, true)), true);
    }
  }

  divUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.get(firstIndex) === 0) {
      this.regs.set(resultIndex, MAX_VALUE);
    } else {
      this.regs.set(resultIndex, ~~(this.regs.get(secondIndex) / this.regs.get(firstIndex)));
    }
  }

  remSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.get(firstIndex) === 0) {
      this.regs.set(resultIndex, this.regs.get(secondIndex));
    } else if (this.regs.get(firstIndex, true) === -1 && this.regs.get(secondIndex, true) === MIN_VALUE) {
      this.regs.set(resultIndex, 0);
    } else {
      this.regs.set(resultIndex, this.regs.get(secondIndex, true) % this.regs.get(firstIndex, true), true);
    }
  }

  remUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.get(firstIndex) === 0) {
      this.regs.set(resultIndex, this.regs.get(secondIndex));
    } else {
      this.regs.set(resultIndex, this.regs.get(secondIndex) % this.regs.get(firstIndex));
    }
  }
}
