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
      signExtend32To64(addWithOverflowU32(this.regs.getLowerU32(firstIndex), this.regs.getLowerU32(secondIndex))),
    );
  }

  addU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, addWithOverflowU64(this.regs.getU64(firstIndex), this.regs.getU64(secondIndex)));
  }

  addImmediateU32(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(
      resultIndex,
      signExtend32To64(addWithOverflowU32(this.regs.getLowerU32(firstIndex), immediate.getU32())),
    );
  }

  addImmediateU64(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(resultIndex, addWithOverflowU64(this.regs.getU64(firstIndex), immediate.getU64()));
  }

  mulU32(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(
      resultIndex,
      signExtend32To64(mulLowerUnsignedU32(this.regs.getLowerU32(firstIndex), this.regs.getLowerU32(secondIndex))),
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
    this.regs.setI64(resultIndex, mulUpperSU(this.regs.getI64(firstIndex), this.regs.getU64(secondIndex)));
  }

  mulImmediateU32(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(
      resultIndex,
      signExtend32To64(mulLowerUnsignedU32(this.regs.getLowerU32(firstIndex), immediate.getU32())),
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
      signExtend32To64(subU32(this.regs.getLowerU32(firstIndex), this.regs.getLowerU32(secondIndex))),
    );
  }
  subU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    this.regs.setU64(resultIndex, subU64(this.regs.getU64(firstIndex), this.regs.getU64(secondIndex)));
  }

  negAddImmediateU32(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(resultIndex, signExtend32To64(subU32(immediate.getU32(), this.regs.getLowerU32(firstIndex))));
  }

  negAddImmediateU64(firstIndex: number, immediate: ImmediateDecoder, resultIndex: number) {
    this.regs.setU64(resultIndex, subU64(immediate.getU64(), this.regs.getU64(firstIndex)));
  }

  divSignedU32(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getLowerU32(secondIndex) === 0) {
      this.regs.setU64(resultIndex, 2n ** 64n - 1n);
    } else if (this.regs.getLowerI32(secondIndex) === -1 && this.regs.getLowerI32(firstIndex) === MIN_VALUE) {
      this.regs.setU64(resultIndex, signExtend32To64(this.regs.getLowerU32(firstIndex)));
    } else {
      this.regs.setI64(resultIndex, signExtend32To64(~~(this.regs.getLowerI32(firstIndex) / this.regs.getLowerI32(secondIndex))));
    }
  }

  divSignedU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU64(secondIndex) === 0n) {
      this.regs.setU64(resultIndex, 2n ** 64n - 1n);
    } else if (this.regs.getI64(secondIndex) === -1n && this.regs.getI64(firstIndex) === -(2n ** 63n)) {
      this.regs.setU64(resultIndex, this.regs.getU64(firstIndex));
    } else {
      this.regs.setI64(resultIndex, ~~(this.regs.getI64(firstIndex) / this.regs.getI64(secondIndex)));
    }
  }

  divUnsignedU32(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getLowerU32(secondIndex) === 0) {
      this.regs.setU64(resultIndex, 2n ** 64n - 1n);
    } else {
      this.regs.setU64(resultIndex, signExtend32To64(~~(this.regs.getLowerU32(firstIndex) / this.regs.getLowerU32(secondIndex))));
    }
  }

  divUnsignedU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU64(secondIndex) === 0n) {
      this.regs.setU64(resultIndex, 2n ** 64n - 1n);
    } else {
      this.regs.setU64(resultIndex, ~~(this.regs.getU64(firstIndex) / this.regs.getU64(secondIndex)));
    }
  }

  remSignedU32(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getLowerU32(secondIndex) === 0) {
      this.regs.setU64(resultIndex, BigInt(this.regs.getLowerI32(firstIndex)));
    } else if (this.regs.getLowerI32(secondIndex) === -1 && this.regs.getLowerI32(firstIndex) === MIN_VALUE) {
      this.regs.setU64(resultIndex, 0n);
    } else {
      this.regs.setI64(resultIndex, signExtend32To64(this.regs.getLowerI32(firstIndex) % this.regs.getLowerI32(secondIndex)));
    }
  }

  remSignedU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU64(secondIndex) === 0n) {
      this.regs.setU64(resultIndex, this.regs.getU64(firstIndex));
    } else if (this.regs.getI64(secondIndex) === -1n && this.regs.getI64(firstIndex) === -(2n ** 63n)) {
      this.regs.setU64(resultIndex, 0n);
    } else {
      this.regs.setI64(resultIndex, this.regs.getI64(firstIndex) % this.regs.getI64(secondIndex));
    }
  }

  remUnsignedU32(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getLowerU32(secondIndex) === 0) {
      this.regs.setU64(resultIndex, signExtend32To64(this.regs.getLowerU32(firstIndex)));
    } else {
      this.regs.setU64(resultIndex, signExtend32To64(this.regs.getLowerU32(firstIndex) % this.regs.getLowerU32(secondIndex)));
    }
  }

  remUnsignedU64(firstIndex: number, secondIndex: number, resultIndex: number) {
    if (this.regs.getU64(secondIndex) === 0n) {
      this.regs.setU64(resultIndex, this.regs.getU64(firstIndex));
    } else {
      this.regs.setU64(resultIndex, this.regs.getU64(firstIndex) % this.regs.getU64(secondIndex));
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
