import { BaseOps } from "./base-ops";
import { MAX_SHIFT, MAX_VALUE, MIN_VALUE } from "./math-consts";

export class MathOps extends BaseOps<"regs"> {
  add(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.addImmediate(firstIndex, this.context.regs.asUnsigned[secondIndex], resultIndex);
  }

  addImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    if (this.context.regs.asUnsigned[firstIndex] > MAX_VALUE - immediateValue) {
      this.context.regs.asUnsigned[resultIndex] =
        MAX_VALUE -
        Math.max(this.context.regs.asUnsigned[firstIndex], immediateValue) +
        Math.min(this.context.regs.asUnsigned[firstIndex], immediateValue) -
        1;
    } else {
      this.context.regs.asUnsigned[resultIndex] = this.context.regs.asUnsigned[firstIndex] + immediateValue;
    }
  }

  mul(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.mulImmediate(firstIndex, this.context.regs.asUnsigned[secondIndex], resultIndex);
  }

  mulUpperUU(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.mulUpperUUImmediate(firstIndex, this.context.regs.asUnsigned[secondIndex], resultIndex);
  }

  mulUpperSS(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.mulUpperSSImmediate(firstIndex, this.context.regs.asSigned[secondIndex], resultIndex);
  }

  mulUpperSU(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.mulUpperSSImmediate(firstIndex, this.context.regs.asUnsigned[secondIndex], resultIndex);
  }

  mulImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    if (this.context.regs.asUnsigned[firstIndex] > MAX_VALUE / immediateValue) {
      const result = (BigInt(this.context.regs.asUnsigned[firstIndex]) * BigInt(immediateValue)) % 2n ** 32n;
      this.context.regs.asUnsigned[resultIndex] = Number(result);
    } else {
      this.context.regs.asUnsigned[resultIndex] = this.context.regs.asUnsigned[firstIndex] * immediateValue;
    }
  }

  mulUpperSSImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    const result = (BigInt(this.context.regs.asSigned[firstIndex]) * BigInt(immediateValue)) >> BigInt(MAX_SHIFT);
    this.context.regs.asSigned[resultIndex] = Number(result % 2n ** 32n);
  }

  mulUpperUUImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    const result = (BigInt(this.context.regs.asUnsigned[firstIndex]) * BigInt(immediateValue)) >> BigInt(MAX_SHIFT);
    this.context.regs.asUnsigned[resultIndex] = Number(result % 2n ** 32n);
  }

  sub(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.negAddImmediate(firstIndex, this.context.regs.asUnsigned[secondIndex], resultIndex);
  }

  negAddImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    if (this.context.regs.asUnsigned[firstIndex] > immediateValue) {
      this.context.regs.asUnsigned[resultIndex] =
        MAX_VALUE - this.context.regs.asUnsigned[firstIndex] + immediateValue + 1;
    } else {
      this.context.regs.asUnsigned[resultIndex] = immediateValue - this.context.regs.asUnsigned[firstIndex];
    }
  }

  divSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.context.regs.asUnsigned[firstIndex] === 0) {
      this.context.regs.asUnsigned[resultIndex] = MAX_VALUE;
    } else if (this.context.regs.asSigned[firstIndex] === -1 && this.context.regs.asSigned[secondIndex] === MIN_VALUE) {
      this.context.regs.asUnsigned[resultIndex] = this.context.regs.asUnsigned[secondIndex];
    } else {
      this.context.regs.asSigned[resultIndex] = ~~(
        this.context.regs.asSigned[secondIndex] / this.context.regs.asSigned[firstIndex]
      );
    }
  }

  divUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.context.regs.asUnsigned[firstIndex] === 0) {
      this.context.regs.asUnsigned[resultIndex] = MAX_VALUE;
    } else {
      this.context.regs.asUnsigned[resultIndex] = ~~(
        this.context.regs.asUnsigned[secondIndex] / this.context.regs.asUnsigned[firstIndex]
      );
    }
  }

  remSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.context.regs.asUnsigned[firstIndex] === 0) {
      this.context.regs.asUnsigned[resultIndex] = this.context.regs.asUnsigned[secondIndex];
    } else if (this.context.regs.asSigned[firstIndex] === -1 && this.context.regs.asSigned[secondIndex] === MIN_VALUE) {
      this.context.regs.asUnsigned[resultIndex] = 0;
    } else {
      this.context.regs.asSigned[resultIndex] =
        this.context.regs.asSigned[secondIndex] % this.context.regs.asSigned[firstIndex];
    }
  }

  remUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.context.regs.asUnsigned[firstIndex] === 0) {
      this.context.regs.asUnsigned[resultIndex] = this.context.regs.asUnsigned[secondIndex];
    } else {
      this.context.regs.asUnsigned[resultIndex] =
        this.context.regs.asUnsigned[secondIndex] % this.context.regs.asUnsigned[firstIndex];
    }
  }
}
