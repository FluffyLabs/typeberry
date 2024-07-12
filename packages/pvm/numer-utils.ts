export function decodeImmediate(bytes: Uint8Array): number {
	const n = bytes.length;
	let value = 0;
	for (let i = 0; i < n; i++) {
		value |= bytes[i] << (8 * i);
	}

	const msb = bytes[n - 1] & 0x80;

	if (msb) {
		for (let i = bytes.length; i < 4; i++) {
			value |= 0xff << (8 * i);
		}

		return -(~value + 1);
	}

	return value;
}
