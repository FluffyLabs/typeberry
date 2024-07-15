import { BaseOps } from "./base-ops";

export class ShiftOps extends BaseOps {
	shiftLogicalLeft(
		firstIndex: number,
		secondIndex: number,
		resultIndex: number,
	) {
		this.shiftLogicalLeftImmediateAlternative(
			firstIndex,
			this.regs.asUnsigned[secondIndex],
			resultIndex,
		);
	}

	shiftLogicalRight(
		firstIndex: number,
		secondIndex: number,
		resultIndex: number,
	) {
		this.shiftLogicalRightImmediateAlternative(
			firstIndex,
			this.regs.asUnsigned[secondIndex],
			resultIndex,
		);
	}

	shiftAritmeticRight(
		firstIndex: number,
		secondIndex: number,
		resultIndex: number,
	) {
		this.shiftAritmeticRightImmediateAlternative(
			firstIndex,
			this.regs.asUnsigned[secondIndex],
			resultIndex,
		);
	}

	shiftLogicalLeftImmediate(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		this.regs.asUnsigned[resultIndex] =
			this.regs.asUnsigned[firstIndex] << (immediateValue % 32);
	}

	shiftLogicalRightImmediate(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		this.regs.asUnsigned[resultIndex] =
			this.regs.asUnsigned[firstIndex] >>> (immediateValue % 32);
	}

	shiftAritmeticRightImmediate(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		this.regs.asUnsigned[resultIndex] =
			this.regs.asUnsigned[firstIndex] >> (immediateValue % 32);
	}

	shiftLogicalLeftImmediateAlternative(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		this.regs.asSigned[resultIndex] =
			immediateValue << (this.regs.asSigned[firstIndex] % 32);
	}

	shiftLogicalRightImmediateAlternative(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		this.regs.asSigned[resultIndex] =
			immediateValue >>> (this.regs.asSigned[firstIndex] % 32);
	}

	shiftAritmeticRightImmediateAlternative(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		this.regs.asUnsigned[resultIndex] =
			immediateValue >> (this.regs.asUnsigned[firstIndex] % 32);
	}
}
