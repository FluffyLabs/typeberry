import { BaseOps } from "./base-ops";
import { MAX_VALUE, MIN_VALUE } from "./math-consts";

export class MathOps extends BaseOps {
	add(firstIndex: number, secondIndex: number, resultIndex: number) {
		this.addImmediate(
			firstIndex,
			this.regs.asUnsigned[secondIndex],
			resultIndex,
		);
	}

	addImmediate(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		if (this.regs.asUnsigned[firstIndex] > MAX_VALUE - immediateValue) {
			this.regs.asUnsigned[resultIndex] =
				MAX_VALUE -
				Math.max(this.regs.asUnsigned[firstIndex], immediateValue) +
				Math.min(this.regs.asUnsigned[firstIndex], immediateValue) -
				1;
		} else {
			this.regs.asUnsigned[resultIndex] =
				this.regs.asUnsigned[firstIndex] + immediateValue;
		}
	}

	mul(firstIndex: number, secondIndex: number, resultIndex: number) {
		this.mulImmediate(firstIndex, this.regs.asSigned[secondIndex], resultIndex);
	}

	mulImmediate(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		if (this.regs.asUnsigned[firstIndex] > MAX_VALUE / immediateValue) {
			const result =
				(BigInt(this.regs.asUnsigned[firstIndex]) * BigInt(immediateValue)) %
				2n ** 32n;
			this.regs.asUnsigned[resultIndex] = Number(result);
		} else {
			this.regs.asUnsigned[resultIndex] =
				this.regs.asUnsigned[firstIndex] * immediateValue;
		}
	}

	sub(firstIndex: number, secondIndex: number, resultIndex: number) {
		if (this.regs.asUnsigned[firstIndex] > this.regs.asUnsigned[secondIndex]) {
			this.regs.asUnsigned[resultIndex] =
				MAX_VALUE -
				this.regs.asUnsigned[firstIndex] +
				this.regs.asUnsigned[secondIndex] +
				1;
		} else {
			this.regs.asUnsigned[resultIndex] =
				this.regs.asUnsigned[secondIndex] - this.regs.asUnsigned[firstIndex];
		}
	}

	divSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
		if (this.regs.asSigned[secondIndex] === 0) {
			this.regs.asSigned[resultIndex] = MAX_VALUE;
		} else if (
			this.regs.asSigned[firstIndex] === MIN_VALUE &&
			this.regs.asSigned[secondIndex] === -1
		) {
			this.regs.asSigned[resultIndex] = this.regs.asUnsigned[firstIndex];
		} else {
			this.regs.asSigned[resultIndex] = ~~(
				this.regs.asSigned[firstIndex] / this.regs.asSigned[secondIndex]
			);
		}
	}

	divUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
		if (this.regs.asUnsigned[secondIndex] === 0) {
			this.regs.asUnsigned[resultIndex] = MAX_VALUE;
		} else {
			this.regs.asUnsigned[resultIndex] = ~~(
				this.regs.asUnsigned[firstIndex] / this.regs.asUnsigned[secondIndex]
			);
		}
	}
}
