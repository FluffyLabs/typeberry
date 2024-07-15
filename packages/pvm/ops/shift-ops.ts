import { BaseOps } from "./base-ops";
import { MAX_VALUE } from "./math-consts";

export class ShiftOps extends BaseOps {
	shiftLogicalLeft(
		firstIndex: number,
		secondIndex: number,
		resultIndex: number,
	) {
		this.regs.signedRegisters[resultIndex] =
			(this.regs.signedRegisters[firstIndex] <<
				this.regs.signedRegisters[secondIndex]) %
			MAX_VALUE;
	}

	shiftLogicalRight(
		firstIndex: number,
		secondIndex: number,
		resultIndex: number,
	) {
		this.regs.signedRegisters[resultIndex] =
			(this.regs.signedRegisters[firstIndex] >>
				this.regs.signedRegisters[secondIndex]) %
			MAX_VALUE;
	}

	shiftAritmeticRight(
		firstIndex: number,
		secondIndex: number,
		resultIndex: number,
	) {
		this.regs.unsignedRegisters[resultIndex] =
			(this.regs.unsignedRegisters[firstIndex] >> // ToDo [Masi] it should be >>> instead of >> but it is not supported in case of Int64
				this.regs.unsignedRegisters[secondIndex]) %
			MAX_VALUE;
	}

	shiftLogicalLeftImmediate(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		this.regs.signedRegisters[resultIndex] =
			(this.regs.signedRegisters[firstIndex] << immediateValue) % MAX_VALUE;
	}

	shiftLogicalRightImmediate(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		this.regs.signedRegisters[resultIndex] =
			(this.regs.signedRegisters[firstIndex] >> immediateValue) % MAX_VALUE;
	}

	shiftAritmeticRightImmediate(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		this.regs.unsignedRegisters[resultIndex] =
			(this.regs.unsignedRegisters[firstIndex] >> immediateValue) % // ToDo [Masi] it should be >>> instead of >> but it is not supported in case of Int64
			MAX_VALUE;
	}

	shiftLogicalLeftImmediateAlternative(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		this.regs.signedRegisters[resultIndex] =
			(immediateValue << this.regs.signedRegisters[firstIndex]) % MAX_VALUE;
	}

	shiftLogicalRightImmediateAlternative(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		this.regs.signedRegisters[resultIndex] =
			(immediateValue >> this.regs.signedRegisters[firstIndex]) % MAX_VALUE;
	}

	shiftAritmeticRightImmediateAlternative(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		this.regs.unsignedRegisters[resultIndex] =
			(immediateValue >> this.regs.unsignedRegisters[firstIndex]) % // ToDo [Masi] it should be >>> instead of >> but it is not supported in case of Int64
			MAX_VALUE;
	}
}
