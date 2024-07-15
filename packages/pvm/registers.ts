const NO_OF_REGISTERS = 13;
const REGISTER_SIZE = 4;

export class Registers {
	private buffer = new ArrayBuffer(NO_OF_REGISTERS * REGISTER_SIZE);
	private view = new DataView(this.buffer);
	signedRegisters = new Int32Array(this.buffer);
	unsignedRegisters = new Uint32Array(this.buffer);

	set(index: number, value: number) {
		const indexOffset = index * REGISTER_SIZE;
		this.view.setUint32(indexOffset, value, true);
	}
}
