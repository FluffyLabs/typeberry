import type { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import { type Registers, signExtend32To64 } from "../registers";
import { MIN_VALUE } from "./math-consts";
import {
  addWithOverflowU32,
  addWithOverflowU64,
  maxBigInt,
  minBigInt,
  mulLowerUnsignedU32,
  mulU64,
  mulUpperSS,
  mulUpperSU,
  mulUpperUU,
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

  addImmediateU32(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(
      resultIndex,
      signExtend32To64(addWithOverflowU32(this.regs.getU32(firstIndex), immediate.getU32())),
    );
  }

  addImmediateU64(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(resultIndex, addWithOverflowU64(this.regs.getU64(firstIndex), immediate.getU64()));
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
    this.regs.setU64(resultIndex, mulUpperUU(this.regs.getU64(firstIndex), this.regs.getU64(secondIndex)));
  }

  mulUpperSS(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setI64(resultIndex, mulUpperSS(this.regs.getI64(firstIndex), this.regs.getI64(secondIndex)));
  }

  mulUpperSU(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setI64(resultIndex, mulUpperSU(this.regs.getI64(secondIndex), this.regs.getU64(firstIndex)));
  }

  mulImmediateU32(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(
      resultIndex,
      signExtend32To64(mulLowerUnsignedU32(this.regs.getU32(firstIndex), immediate.getU32())),
    );
  }

  mulImmediateU64(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(resultIndex, mulU64(this.regs.getU64(firstIndex), immediate.getU64()));
  }

  mulUpperSSImmediate(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setI64(resultIndex, mulUpperSS(this.regs.getI64(firstIndex), immediate.getI64()));
  }

  mulUpperUUImmediate(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(resultIndex, mulUpperUU(this.regs.getU64(firstIndex), immediate.getU64()));
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

  negAddImmediateU32(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(resultIndex, signExtend32To64(subU32(this.regs.getU32(firstIndex), immediate.getU32())));
  }

  negAddImmediateU64(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(resultIndex, subU64(this.regs.getU64(firstIndex), immediate.getU64()));
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

  max(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setI64(resultIndex, maxBigInt(this.regs.getI64(firstIndex), this.regs.getI64(secondIndex)));
  }

  maxU(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, maxBigInt(this.regs.getU64(firstIndex), this.regs.getU64(secondIndex)));
  }

  min(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setI64(resultIndex, minBigInt(this.regs.getI64(firstIndex), this.regs.getI64(secondIndex)));
  }

  minU(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, minBigInt(this.regs.getU64(firstIndex), this.regs.getU64(secondIndex)));
  }
}
