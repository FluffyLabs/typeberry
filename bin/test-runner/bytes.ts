function assert(value: boolean, description: string): asserts value is true {
	if (!value) throw new Error(description);
}

export class Blob {
	readonly buffer: ArrayBuffer = new ArrayBuffer(0);
	readonly length?: number = 0;

	constructor(buffer: ArrayBuffer) {
		this.buffer = buffer;
		this.length = buffer.byteLength;
	}

	static parseBlob(v: string): Blob {
		const len = v.length;
		if (len % 2 === 1 || !v.startsWith("0x")) {
			throw new Error(`Invalid hex string: ${v}.`);
		}
		// NOTE [ToDr] alloc
		const buffer = new ArrayBuffer(len / 2 - 1);
		const bytes = new Uint8Array(buffer);
		for (let i = 2; i < len - 1; i += 2) {
			const c = v.substr(i, 2);
			bytes[i / 2 - 1] = Number.parseInt(c, 16);
		}

		return new Blob(buffer);
	}
}

export class Bytes<T extends number> {
	readonly view: DataView = new DataView(new ArrayBuffer(0));
	readonly length: T;

	constructor(view: DataView, len: T) {
		assert(
			view.byteLength === len,
			`Given buffer has incorrect size ${view.byteLength} vs expected ${len}`,
		);
		this.view = view;
		this.length = len;
	}

	static parseBytes<X extends number>(v: string, len: X): Bytes<X> {
		if (v.length > 2 * len + 2) {
			throw new Error(
				`Input string too long. Expected ${len}, got ${v.length / 2 - 1}`,
			);
		}

		const blob = Blob.parseBlob(v);
		return new Bytes(new DataView(blob.buffer), len);
	}
}
