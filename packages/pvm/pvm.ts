import { FixedArray } from "../types";
import { assemblify } from "./assemblify";
import * as $ from "scale-codec";
import { MemoryChunkItem, PageMapItem, Program } from "./types";

type InitialState = {
	regs?: FixedArray<number, 13>;
	pc?: number;
	pageMap?: Array<PageMapItem>;
	memory?: Array<MemoryChunkItem>;
	gas?: number;
};

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
	private program: Program;
	private pc: number = 0;
	private regs: FixedArray<number, 13>;
	private gas: number;
	private pageMap: Array<PageMapItem>;
	private memory: Array<MemoryChunkItem>;
	private status: "trap" | "halt" = "trap";

	constructor(rawProgram: Array<number>, initialState: InitialState = {}) {
		const [jLength, z, cLength, c, k] = this.decodeProgram(
			new Uint8Array(rawProgram),
		);
		this.program = { cLength, jLength, z, c, k };
		this.pc = initialState.pc ?? 0;
		this.regs =
			initialState.regs ??
			(new Array<number>(13).fill(0) as FixedArray<number, 13>);
		this.gas = initialState.gas ?? 0;
		this.pageMap = initialState.pageMap ?? [];
		this.memory = initialState.memory ?? [];
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
		const p = assemblify(this.program.c, this.program.k);
		console.table(p);
	}

	runProgram() {
		this.status = "trap";
	}

	getState() {
		return {
			pc: this.pc,
			regs: this.regs,
			gas: this.gas,
			pageMap: this.pageMap,
			memory: this.memory,
			status: this.status,
		};
	}
}
