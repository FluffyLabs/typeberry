import { BaseOps } from "./base-ops";
import { MAX_VALUE } from "./math-consts";

export class BitOps extends BaseOps {
	or(firstIndex: number, secondIndex: number, resultIndex: number) {
		this.regs.asUnsigned[resultIndex] =
			(this.regs.asUnsigned[firstIndex] | this.regs.asUnsigned[secondIndex]) %
			MAX_VALUE;
	}

	orImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
		this.regs.asUnsigned[resultIndex] =
			(this.regs.asUnsigned[firstIndex] | immediateValue) % MAX_VALUE;
	}

	and(firstIndex: number, secondIndex: number, resultIndex: number) {
		this.regs.asSigned[resultIndex] =
			(this.regs.asSigned[firstIndex] & this.regs.asSigned[secondIndex]) %
			MAX_VALUE;
	}

	andImmediate(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		this.regs.asSigned[resultIndex] =
			(this.regs.asSigned[firstIndex] & immediateValue) % MAX_VALUE;
	}

	xor(firstIndex: number, secondIndex: number, resultIndex: number) {
		this.regs.asUnsigned[resultIndex] =
			this.regs.asUnsigned[firstIndex] ^ this.regs.asUnsigned[secondIndex];
	}

	xorImmediate(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		this.regs.asUnsigned[resultIndex] =
			this.regs.asUnsigned[firstIndex] ^ immediateValue;
	}
}
