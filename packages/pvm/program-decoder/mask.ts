export class Mask {
	private mask: Uint8Array;

	constructor(code: number[]) {
		this.mask = new Uint8Array(code);
	}

	isInstruction(index: number) {
		const byteNumber = Math.floor(index / 8);
		const bitNumber = index % 8;
		const mask = 1 << bitNumber;
		return (this.mask[byteNumber] & mask) > 0;
	}
}
