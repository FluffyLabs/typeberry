import { assemblify } from "./assemblify";
import * as $ from "scale-codec";

type InitialState = {};

const zz = $.array($.u8);
/*
// dynamic jump table
j = Vec<u8 | u16 | u24 | u32>
// number of octets of every index in dynamic jump table
z = 1, 2, 3, 4, 5, 6, 7, 8 

p = len(j)
    ++ z
    ++ len(c)
    ++ [...]
    ++ c 
    ++ k (len(k) == len(c))
*/

export class Pvm {
	private program: Array<number>;
	private k: Array<number>;
	private jLength: number;
	private z: number;
	private cLength: number;

	constructor(
		rawProgram: Array<number>,
		private initialState: InitialState = {},
	) {
		const [jLength, z, cLength, program, k] = this.decodeProgram(
			new Uint8Array(rawProgram),
		);
		this.cLength = cLength;
		this.jLength = jLength;
		this.z = z;
		this.program = program;
		this.k = k;
	}

	private decodeProgram(program: Uint8Array) {
		const first3Numbers = $.tuple($.u8, $.u8, $.u8);
		const [jLength, z, cLength] = first3Numbers.decode(program);
		const jSize = z <= 8 ? 8 : z <= 16 ? 16 : (32 as const);
		const jumpTable =
			jLength > 0 ? [$.sizedArray($.int(false, jSize), jLength)] : [];
		return $.tuple(
			$.u8,
			$.u8,
			$.u8,
			...jumpTable,
			$.sizedArray($.u8, cLength),
			$.sizedArray($.u8, Math.ceil(cLength / 8)),
		).decode(program);
	}

	printProgram() {
		const p = assemblify(this.program, this.k);
		console.table(p);
	}
}
