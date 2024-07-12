import { BaseOps } from "./base-ops";
import { MAX_VALUE, MINUS_ONE, MIN_VALUE, ONE, ZERO } from "./math-consts";

export class MathOps extends BaseOps {
	add(firstIndex: number, secondIndex: number, resultIndex: number) {
		this.regs.unsignedRegisters[resultIndex] =
			(this.regs.unsignedRegisters[firstIndex] +
				this.regs.unsignedRegisters[secondIndex]) %
			MAX_VALUE;
	}

	addImmediate(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		this.regs.unsignedRegisters[resultIndex] =
			(this.regs.unsignedRegisters[firstIndex] + BigInt(immediateValue)) %
			MAX_VALUE;
	}

	mul(firstIndex: number, secondIndex: number, resultIndex: number) {
		this.regs.signedRegisters[resultIndex] =
			(this.regs.signedRegisters[firstIndex] *
				this.regs.signedRegisters[secondIndex]) %
			MAX_VALUE;
	}

	mulImmediate(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		this.regs.signedRegisters[resultIndex] =
			(this.regs.signedRegisters[firstIndex] * BigInt(immediateValue)) %
			MAX_VALUE;
	}

	sub(firstIndex: number, secondIndex: number, resultIndex: number) {
		this.regs.unsignedRegisters[resultIndex] =
			(MAX_VALUE +
				this.regs.unsignedRegisters[firstIndex] -
				this.regs.unsignedRegisters[secondIndex]) %
			MAX_VALUE;
	}

	divSigned(firstIndex: number, secondIndex: number, resultIndex: number) {
		if (this.regs.signedRegisters[secondIndex] === ZERO) {
			this.regs.signedRegisters[resultIndex] = MAX_VALUE - ONE;
		} else if (
			this.regs.signedRegisters[firstIndex] === MIN_VALUE &&
			this.regs.signedRegisters[secondIndex] === MINUS_ONE
		) {
			this.regs.signedRegisters[resultIndex] =
				this.regs.unsignedRegisters[firstIndex];
		} else {
			this.regs.signedRegisters[resultIndex] = ~~(
				this.regs.signedRegisters[firstIndex] /
				this.regs.signedRegisters[secondIndex]
			);
		}
	}

	divUnsigned(firstIndex: number, secondIndex: number, resultIndex: number) {
		if (this.regs.unsignedRegisters[secondIndex] === ZERO) {
			this.regs.unsignedRegisters[resultIndex] = MAX_VALUE - ONE;
		} else {
			this.regs.unsignedRegisters[resultIndex] = ~~(
				this.regs.unsignedRegisters[firstIndex] /
				this.regs.unsignedRegisters[secondIndex]
			);
		}
	}
}
