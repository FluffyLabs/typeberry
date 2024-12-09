import type { Registers } from "../registers";
import { MAX_VALUE, MIN_VALUE } from "./math-consts";
import { addWithOverflow, mulLowerUnsigned, mulUpperSigned, mulUpperUnsigned, sub } from "./math-utils";

export class MathOps {
  constructor(private regs: Registers) {}

  add(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU32(resultIndex, addWithOverflow(this.regs.getU32(firstIndex), this.regs.getU32(secondIndex)));
  }

  addImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, addWithOverflow(this.regs.getU32(firstIndex), immediateValue));
  }

  mul(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU32(resultIndex, mulLowerUnsigned(this.regs.getU32(firstIndex), this.regs.getU32(secondIndex)));
  }

  mulUpperUU(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU32(resultIndex, mulUpperUnsigned(this.regs.getU32(firstIndex), this.regs.getU32(secondIndex)));
  }

  mulUpperSS(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setI32(resultIndex, mulUpperSigned(this.regs.getI32(firstIndex), this.regs.getI32(secondIndex)));
  }

  mulUpperSU(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setI32(resultIndex, mulUpperSigned(this.regs.getI32(firstIndex), this.regs.getU32(secondIndex)));
  }

  mulImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, mulLowerUnsigned(this.regs.getU32(firstIndex), immediateValue));
  }

  mulUpperSSImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setI32(resultIndex, mulUpperSigned(this.regs.getI32(firstIndex), immediateValue));
  }

  mulUpperUUImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, mulUpperUnsigned(this.regs.getU32(firstIndex), immediateValue));
  }

  sub(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU32(resultIndex, sub(this.regs.getU32(firstIndex), this.regs.getU32(secondIndex)));
  }

  negAddImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU32(resultIndex, sub(this.regs.getU32(firstIndex), immediateValue));
  }

  divSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU32(firstIndex) === 0) {
      this.regs.setU32(resultIndex, MAX_VALUE);
    } else if (this.regs.getI32(firstIndex) === -1 && this.regs.getI32(secondIndex) === MIN_VALUE) {
      this.regs.setU32(resultIndex, this.regs.getU32(secondIndex));
    } else {
      this.regs.setI32(resultIndex, ~~(this.regs.getI32(secondIndex) / this.regs.getI32(firstIndex)));
    }
  }

  divUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU32(firstIndex) === 0) {
      this.regs.setU32(resultIndex, MAX_VALUE);
    } else {
      this.regs.setU32(resultIndex, ~~(this.regs.getU32(secondIndex) / this.regs.getU32(firstIndex)));
    }
  }

  remSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU32(firstIndex) === 0) {
      this.regs.setU32(resultIndex, this.regs.getU32(secondIndex));
    } else if (this.regs.getI32(firstIndex) === -1 && this.regs.getI32(secondIndex) === MIN_VALUE) {
      this.regs.setU32(resultIndex, 0);
    } else {
      this.regs.setI32(resultIndex, this.regs.getI32(secondIndex) % this.regs.getI32(firstIndex));
    }
  }

  remUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU32(firstIndex) === 0) {
      this.regs.setU32(resultIndex, this.regs.getU32(secondIndex));
    } else {
      this.regs.setU32(resultIndex, this.regs.getU32(secondIndex) % this.regs.getU32(firstIndex));
    }
  }
}
