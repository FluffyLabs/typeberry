export class Mask {
	constructor(private mask: Uint8Array) {}

	isInstruction(index: number) {
		const byteNumber = Math.floor(index / 8);
		const bitNumber = index % 8;
		const mask = 1 << bitNumber;
		return (this.mask[byteNumber] & mask) > 0;
	}
}
