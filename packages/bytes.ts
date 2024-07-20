function assert(value: boolean, description: string): asserts value is true {
	if (!value) throw new Error(description);
}

function bufferToHexString(buffer: ArrayBuffer): string {
	// TODO [ToDr] consider using TextDecoder API?
	let s = "0x";
	const asUint = new Uint8Array(buffer);
	for (const v of asUint) {
		s += v.toString(16).padStart(2, "0");
	}
	return s;
}

export class BytesBlob {
	readonly buffer: ArrayBuffer = new ArrayBuffer(0);
	readonly length: number = 0;

	constructor(buffer: ArrayBuffer) {
		this.buffer = buffer;
		this.length = buffer.byteLength;
	}

	toString() {
		return bufferToHexString(this.buffer);
	}

	static fromBytes(v: number[]): BytesBlob {
		const arr = new Uint8Array(v);
		return new BytesBlob(arr.buffer);
	}

	static parseBlobNoPrefix(v: string): BytesBlob {
		const len = v.length;
		if (len % 2 === 1) {
			throw new Error(`Odd number of nibbles. Invalid hex string: ${v}.`);
		}
		// NOTE [ToDr] alloc
		const buffer = new ArrayBuffer(len / 2);
		const bytes = new Uint8Array(buffer);
		for (let i = 0; i < len - 1; i += 2) {
			const c = v.substring(i, i + 2);
			const parsed = Number(`0x${c}`);
			if (Number.isNaN(parsed)) {
				throw new Error(`Invalid characters in hex byte string: ${c}`);
			}
			bytes[i / 2] = parsed;
		}

		return new BytesBlob(buffer);
	}

	static parseBlob(v: string): BytesBlob {
		if (!v.startsWith("0x")) {
			throw new Error(`Missing 0x prefix: ${v}.`);
		}
		return BytesBlob.parseBlobNoPrefix(v.substring(2));
	}
}

export class Bytes<T extends number> {
	readonly raw: DataView = new DataView(new ArrayBuffer(0));
	readonly length: T;

	constructor(raw: DataView, len: T) {
		assert(
			raw.byteLength === len,
			`Given buffer has incorrect size ${raw.byteLength} vs expected ${len}`,
		);
		this.raw = raw;
		this.length = len;
	}

	toString() {
		// TODO [ToDr] This disregards offset and length we should not be accessing raw buffer.
		return bufferToHexString(this.raw.buffer);
	}

	static zero<X extends number>(len: X): Bytes<X> {
		return new Bytes(new DataView(new ArrayBuffer(len)), len);
	}

	static parseBytesNoPrefix<X extends number>(v: string, len: X): Bytes<X> {
		if (v.length > 2 * len) {
			throw new Error(
				`Input string too long. Expected ${len}, got ${v.length / 2}`,
			);
		}

		const blob = BytesBlob.parseBlobNoPrefix(v);
		return new Bytes(new DataView(blob.buffer), len);
	}

	static parseBytes<X extends number>(v: string, len: X): Bytes<X> {
		if (v.length > 2 * len + 2) {
			throw new Error(
				`Input string too long. Expected ${len}, got ${v.length / 2 - 1}`,
			);
		}

		const blob = BytesBlob.parseBlob(v);
		return new Bytes(new DataView(blob.buffer), len);
	}
}
