import { BaseOps } from "./base-ops";
import { MAX_VALUE } from "./math-consts";

export class BitOps extends BaseOps {
	or(firstIndex: number, secondIndex: number, resultIndex: number) {
		this.regs.unsignedRegisters[resultIndex] =
			(this.regs.unsignedRegisters[firstIndex] |
				this.regs.unsignedRegisters[secondIndex]) %
			MAX_VALUE;
	}

	orImmediate(firstIndex: number, immediateValue: number, resultIndex: number) {
		this.regs.unsignedRegisters[resultIndex] =
			(this.regs.unsignedRegisters[firstIndex] | immediateValue) % MAX_VALUE;
	}

	and(firstIndex: number, secondIndex: number, resultIndex: number) {
		this.regs.signedRegisters[resultIndex] =
			(this.regs.signedRegisters[firstIndex] &
				this.regs.signedRegisters[secondIndex]) %
			MAX_VALUE;
	}

	andImmediate(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		this.regs.signedRegisters[resultIndex] =
			(this.regs.signedRegisters[firstIndex] & immediateValue) % MAX_VALUE;
	}

	xor(firstIndex: number, secondIndex: number, resultIndex: number) {
		this.regs.unsignedRegisters[resultIndex] =
			(this.regs.unsignedRegisters[firstIndex] |
				this.regs.unsignedRegisters[secondIndex]) %
			MAX_VALUE;
	}

	xorImmediate(
		firstIndex: number,
		immediateValue: number,
		resultIndex: number,
	) {
		this.regs.unsignedRegisters[resultIndex] =
			(this.regs.unsignedRegisters[firstIndex] ^ immediateValue) % MAX_VALUE;
	}
}
