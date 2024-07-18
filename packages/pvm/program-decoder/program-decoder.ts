import * as $ from "scale-codec";
import { Mask } from "./mask";

const first3Numbers = $.tuple($.u8, $.u8, $.u8); // TODO [MaSi] according to GP - [0] and [2] should be compact int - but there is a single byte in tests
const getJumpTable = (itemSize: number, jumpTableLength: number) => {
	if (jumpTableLength === 0) {
		return [];
	}

	const roundedItemSize = itemSize <= 8 ? 8 : itemSize <= 16 ? 16 : 32;
	return [$.sizedArray($.int(false, roundedItemSize), jumpTableLength)];
};

export class ProgramDecoder {
	private code: Uint8Array;
	private mask: Mask;

	constructor(rawProgram: Uint8Array) {
		const { code, mask } = this.decodeProgram(rawProgram);

		this.code = new Uint8Array(code);
		this.mask = new Mask(mask);
	}

	private decodeProgram(program: Uint8Array) {
		const [jumpTableLength, jumpTableItemSize, codeLength] =
			first3Numbers.decode(program);
		const jumpTable = getJumpTable(jumpTableItemSize, jumpTableLength);
		const decoded = $.tuple(
			$.u8,
			$.u8,
			$.u8,
			...jumpTable,
			$.sizedArray($.u8, codeLength),
			$.sizedArray($.u8, Math.ceil(codeLength / 8)),
		).decode(program);

		return {
			codeLength,
			jumpTableLength,
			jumpTableItemSize,
			jumpTable: jumpTableLength > 0 ? decoded[3] : [],
			code: decoded[jumpTableLength > 0 ? 4 : 3],
			mask: decoded[jumpTableLength > 0 ? 5 : 4],
		};
	}

	getMask() {
		return this.mask;
	}

	getCode() {
		return this.code;
	}
}
