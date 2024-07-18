import { LittleEndianDecoder } from "./little-endian-decoder";

const MASKS = [0xff, 0xfe, 0xfc, 0xf8, 0xf0, 0xe0, 0xc0, 0x80];

type Result = {
	bytesToSkip: number;
	value: bigint;
};

export function decodeNaturalNumber(bytes: Uint8Array): Result {
	const littleEndianDecoder = new LittleEndianDecoder();
	const l = decodeLengthAfterFirstByte(bytes[0]);

	if (l === 8) {
		return {
			value: littleEndianDecoder.decode(bytes.subarray(1, 9)),
			bytesToSkip: 9,
		};
	}

	if (l === 0) {
		return { value: BigInt(bytes[0]), bytesToSkip: 1 };
	}

	const restBytesValue = littleEndianDecoder.decode(bytes.subarray(1, l + 1));
	const firstByteValue = BigInt(bytes[0]) + 2n ** (8n - BigInt(l)) - 2n ** 8n;

	return {
		value: restBytesValue + firstByteValue * 2n ** (8n * BigInt(l)),
		bytesToSkip: l + 1,
	};
}

function decodeLengthAfterFirstByte(firstByte: number) {
	for (let i = 0; i < MASKS.length; i++) {
		if (firstByte >= MASKS[i]) {
			return 8 - i;
		}
	}

	return 0;
}
