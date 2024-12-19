import { type Registers, signExtend32To64 } from "../registers";
import { MIN_VALUE } from "./math-consts";
import {
  addWithOverflowU32,
  addWithOverflowU64,
  mulLowerUnsignedU32,
  mulU64,
  mulUpper,
  subU32,
  subU64,
} from "./math-utils";

export class MathOps {
  constructor(private regs: Registers) {}

  addU32(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(
      resultIndex,
      signExtend32To64(addWithOverflowU32(this.regs.getU32(firstIndex), this.regs.getU32(secondIndex))),
    );
  }

  addU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, addWithOverflowU64(this.regs.getU64(firstIndex), this.regs.getU64(secondIndex)));
  }

  addImmediateU32(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU64(resultIndex, signExtend32To64(addWithOverflowU32(this.regs.getU32(firstIndex), immediateValue)));
  }

  addImmediateU64(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setU64(resultIndex, addWithOverflowU64(this.regs.getU64(firstIndex), BigInt(immediateValue)));
  }

  mulU32(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(
      resultIndex,
      signExtend32To64(mulLowerUnsignedU32(this.regs.getU32(firstIndex), this.regs.getU32(secondIndex))),
    );
  }

  mulU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, mulU64(this.regs.getU64(firstIndex), this.regs.getU64(secondIndex)));
  }

  mulUpperUU(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(
      resultIndex,
      signExtend32To64(mulUpper(this.regs.getU64(firstIndex), this.regs.getU64(secondIndex))),
    );
  }

  mulUpperSS(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setI64(
      resultIndex,
      signExtend32To64(mulUpper(this.regs.getI64(firstIndex), this.regs.getI64(secondIndex))),
    );
  }

  mulUpperSU(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setI64(
      resultIndex,
      signExtend32To64(mulUpper(this.regs.getI64(firstIndex), this.regs.getU64(secondIndex))),
    );
  }

  mulImmediateU32(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU64(resultIndex, signExtend32To64(mulLowerUnsignedU32(this.regs.getU32(firstIndex), immediateValue)));
  }

  mulImmediateU64(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setU64(resultIndex, mulU64(this.regs.getU64(firstIndex), BigInt(immediateValue)));
  }

  mulUpperSSImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setI64(resultIndex, signExtend32To64(mulUpper(this.regs.getI64(firstIndex), BigInt(immediateValue))));
  }

  mulUpperUUImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU64(resultIndex, signExtend32To64(mulUpper(this.regs.getU64(firstIndex), BigInt(immediateValue))));
  }

  subU32(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(
      resultIndex,
      signExtend32To64(subU32(this.regs.getU32(firstIndex), this.regs.getU32(secondIndex))),
    );
  }
  subU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, subU64(this.regs.getU64(firstIndex), this.regs.getU64(secondIndex)));
  }

  negAddImmediateU32(firstIndex: number, immediateValue: number, resultIndex: number) {
    this.regs.setU64(resultIndex, signExtend32To64(subU32(this.regs.getU32(firstIndex), immediateValue)));
  }

  negAddImmediateU64(firstIndex: number, immediateValue: bigint, resultIndex: number) {
    this.regs.setU64(resultIndex, subU64(this.regs.getU64(firstIndex), BigInt(immediateValue)));
  }

  divSignedU32(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU32(firstIndex) === 0) {
      this.regs.setU64(resultIndex, 2n ** 64n - 1n);
    } else if (this.regs.getI32(firstIndex) === -1 && this.regs.getI32(secondIndex) === MIN_VALUE) {
      this.regs.setU64(resultIndex, signExtend32To64(this.regs.getU32(secondIndex)));
    } else {
      this.regs.setI64(resultIndex, signExtend32To64(~~(this.regs.getI32(secondIndex) / this.regs.getI32(firstIndex))));
    }
  }

  divSignedU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU64(firstIndex) === 0n) {
      this.regs.setU64(resultIndex, 2n ** 64n - 1n);
    } else if (this.regs.getI64(firstIndex) === -1n && this.regs.getI64(secondIndex) === -(2n ** 63n)) {
      this.regs.setU64(resultIndex, this.regs.getU64(secondIndex));
    } else {
      this.regs.setI64(resultIndex, ~~(this.regs.getI64(secondIndex) / this.regs.getI64(firstIndex)));
    }
  }

  divUnsignedU32(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU32(firstIndex) === 0) {
      this.regs.setU64(resultIndex, 2n ** 64n - 1n);
    } else {
      this.regs.setU64(resultIndex, signExtend32To64(~~(this.regs.getU32(secondIndex) / this.regs.getU32(firstIndex))));
    }
  }

  divUnsignedU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU64(firstIndex) === 0n) {
      this.regs.setU64(resultIndex, 2n ** 64n - 1n);
    } else {
      this.regs.setU64(resultIndex, ~~(this.regs.getU64(secondIndex) / this.regs.getU64(firstIndex)));
    }
  }

  remSignedU32(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU32(firstIndex) === 0) {
      this.regs.setU64(resultIndex, BigInt(this.regs.getI32(secondIndex)));
    } else if (this.regs.getI32(firstIndex) === -1 && this.regs.getI32(secondIndex) === MIN_VALUE) {
      this.regs.setU64(resultIndex, 0n);
    } else {
      this.regs.setI64(resultIndex, signExtend32To64(this.regs.getI32(secondIndex) % this.regs.getI32(firstIndex)));
    }
  }

  remSignedU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU64(firstIndex) === 0n) {
      this.regs.setU64(resultIndex, this.regs.getU64(secondIndex));
    } else if (this.regs.getI64(firstIndex) === -1n && this.regs.getI64(secondIndex) === -(2n ** 63n)) {
      this.regs.setU64(resultIndex, 0n);
    } else {
      this.regs.setI64(resultIndex, this.regs.getI64(secondIndex) % this.regs.getI64(firstIndex));
    }
  }

  remUnsignedU32(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU32(firstIndex) === 0) {
      this.regs.setU64(resultIndex, signExtend32To64(this.regs.getU32(secondIndex)));
    } else {
      this.regs.setU64(resultIndex, signExtend32To64(this.regs.getU32(secondIndex) % this.regs.getU32(firstIndex)));
    }
  }

  remUnsignedU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU64(firstIndex) === 0n) {
      this.regs.setU64(resultIndex, this.regs.getU64(secondIndex));
    } else {
      this.regs.setU64(resultIndex, this.regs.getU64(secondIndex) % this.regs.getU64(firstIndex));
    }
  }
}
