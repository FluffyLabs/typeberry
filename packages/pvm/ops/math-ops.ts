import type { Context } from "../context";
import { BaseOps } from "./base-ops";
import { MAX_SHIFT, MAX_VALUE, MIN_VALUE } from "./math-consts";

export class MathOps extends BaseOps<Pick<Context, "regs">> {
  add(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.addImmediate(firstIndex, this.ctx.regs.asUnsigned[secondIndex], resultIndex);
  }

  addImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    if (this.ctx.regs.asUnsigned[firstIndex] > MAX_VALUE - immediateValue) {
      this.ctx.regs.asUnsigned[resultIndex] =
        MAX_VALUE -
        Math.max(this.ctx.regs.asUnsigned[firstIndex], immediateValue) +
        Math.min(this.ctx.regs.asUnsigned[firstIndex], immediateValue) -
        1;
    } else {
      this.ctx.regs.asUnsigned[resultIndex] = this.ctx.regs.asUnsigned[firstIndex] + immediateValue;
    }
  }

  mul(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.mulImmediate(firstIndex, this.ctx.regs.asUnsigned[secondIndex], resultIndex);
  }

  mulUpperUU(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.mulUpperUUImmediate(firstIndex, this.ctx.regs.asUnsigned[secondIndex], resultIndex);
  }

  mulUpperSS(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.mulUpperSSImmediate(firstIndex, this.ctx.regs.asSigned[secondIndex], resultIndex);
  }

  mulUpperSU(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.mulUpperSSImmediate(firstIndex, this.ctx.regs.asUnsigned[secondIndex], resultIndex);
  }

  mulImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    if (this.ctx.regs.asUnsigned[firstIndex] > MAX_VALUE / immediateValue) {
      const result = (BigInt(this.ctx.regs.asUnsigned[firstIndex]) * BigInt(immediateValue)) % 2n ** 32n;
      this.ctx.regs.asUnsigned[resultIndex] = Number(result);
    } else {
      this.ctx.regs.asUnsigned[resultIndex] = this.ctx.regs.asUnsigned[firstIndex] * immediateValue;
    }
  }

  mulUpperSSImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    const result = (BigInt(this.ctx.regs.asSigned[firstIndex]) * BigInt(immediateValue)) >> BigInt(MAX_SHIFT);
    this.ctx.regs.asSigned[resultIndex] = Number(result % 2n ** 32n);
  }

  mulUpperUUImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    const result = (BigInt(this.ctx.regs.asUnsigned[firstIndex]) * BigInt(immediateValue)) >> BigInt(MAX_SHIFT);
    this.ctx.regs.asUnsigned[resultIndex] = Number(result % 2n ** 32n);
  }

  sub(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.negAddImmediate(firstIndex, this.ctx.regs.asUnsigned[secondIndex], resultIndex);
  }

  negAddImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    if (this.ctx.regs.asUnsigned[firstIndex] > immediateValue) {
      this.ctx.regs.asUnsigned[resultIndex] = MAX_VALUE - this.ctx.regs.asUnsigned[firstIndex] + immediateValue + 1;
    } else {
      this.ctx.regs.asUnsigned[resultIndex] = immediateValue - this.ctx.regs.asUnsigned[firstIndex];
    }
  }

  divSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.ctx.regs.asUnsigned[firstIndex] === 0) {
      this.ctx.regs.asUnsigned[resultIndex] = MAX_VALUE;
    } else if (this.ctx.regs.asSigned[firstIndex] === -1 && this.ctx.regs.asSigned[secondIndex] === MIN_VALUE) {
      this.ctx.regs.asUnsigned[resultIndex] = this.ctx.regs.asUnsigned[secondIndex];
    } else {
      this.ctx.regs.asSigned[resultIndex] = ~~(
        this.ctx.regs.asSigned[secondIndex] / this.ctx.regs.asSigned[firstIndex]
      );
    }
  }

  divUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.ctx.regs.asUnsigned[firstIndex] === 0) {
      this.ctx.regs.asUnsigned[resultIndex] = MAX_VALUE;
    } else {
      this.ctx.regs.asUnsigned[resultIndex] = ~~(
        this.ctx.regs.asUnsigned[secondIndex] / this.ctx.regs.asUnsigned[firstIndex]
      );
    }
  }

  remSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.ctx.regs.asUnsigned[firstIndex] === 0) {
      this.ctx.regs.asUnsigned[resultIndex] = this.ctx.regs.asUnsigned[secondIndex];
    } else if (this.ctx.regs.asSigned[firstIndex] === -1 && this.ctx.regs.asSigned[secondIndex] === MIN_VALUE) {
      this.ctx.regs.asUnsigned[resultIndex] = 0;
    } else {
      this.ctx.regs.asSigned[resultIndex] = this.ctx.regs.asSigned[secondIndex] % this.ctx.regs.asSigned[firstIndex];
    }
  }

  remUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.ctx.regs.asUnsigned[firstIndex] === 0) {
      this.ctx.regs.asUnsigned[resultIndex] = this.ctx.regs.asUnsigned[secondIndex];
    } else {
      this.ctx.regs.asUnsigned[resultIndex] =
        this.ctx.regs.asUnsigned[secondIndex] % this.ctx.regs.asUnsigned[firstIndex];
    }
  }
}
