const NO_OF_REGISTERS = 13;
const REGISTER_SIZE = 8;

export class Registers {
	private buffer = new ArrayBuffer(NO_OF_REGISTERS * REGISTER_SIZE);
	signedRegisters = new BigInt64Array(this.buffer);
	unsignedRegisters = new BigUint64Array(this.buffer);

	set(index: number, value: number) {
		this.unsignedRegisters[index] = BigInt(value);
	}

	get(index: number) {
		return Number(this.unsignedRegisters[index]);
	}
}
