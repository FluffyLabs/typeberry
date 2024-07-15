export class RegisterIndexDecoder {
	private byte = new Int8Array(1);

	setByte(byte: number) {
		this.byte[0] = byte;
	}

	getFirstIndex() {
		return this.byte[0] & 0x0f;
	}

	getSecondIndex() {
		return (this.byte[0] & 0xf0) >> 4;
	}
}
