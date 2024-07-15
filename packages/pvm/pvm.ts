import * as $ from "scale-codec";
import type { FixedArray } from "../fixed-array";
import { assemblify } from "./assemblify";
import {
	ArgumentType,
	instructionArgumentTypeMap,
	instructionGasMap,
} from "./consts";
import { Instruction } from "./instruction";
import { decodeImmediate } from "./numer-utils";
import { BitOps } from "./ops/bit-ops";
import { MathOps } from "./ops/math-ops";
import { ShiftOps } from "./ops/shift-ops";
import { Registers } from "./registers";

type InitialState = {
	regs?: FixedArray<number, 13>;
	pc?: number;
	pageMap?: PageMapItem[];
	memory?: MemoryChunkItem[];
	gas?: number;
};

type MemoryChunkItem = {
	address: number;
	contents: number[];
};

type PageMapItem = {
	address: number;
	length: number;
	"is-writable": boolean;
};

type Program = {
	c: number[];
	k: number[];
	jLength: number;
	z: number;
	cLength: number;
};

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
	private pc = 0;
	private registers = new Registers();
	private mathOps = new MathOps(this.registers);
	private shiftOps = new ShiftOps(this.registers);
	private bitOps = new BitOps(this.registers);
	private gas: number;
	private pageMap: PageMapItem[];
	private memory: MemoryChunkItem[];
	private status: "trap" | "halt" = "trap";

	constructor(rawProgram: number[], initialState: InitialState = {}) {
		const [jLength, z, cLength, c, k] = this.decodeProgram(
			new Uint8Array(rawProgram),
		);
		this.program = { cLength, jLength, z, c, k };
		this.pc = initialState.pc ?? 0;

		for (let i = 0; i < 13; i++) {
			this.registers.set(i, initialState.regs?.[i] ?? 0);
		}
		this.gas = initialState.gas ?? 0;
		this.pageMap = initialState.pageMap ?? [];
		this.memory = initialState.memory ?? [];
	}

	private decodeProgram(program: Uint8Array) {
		const first3Numbers = $.tuple($.u8, $.u8, $.u8); // TODO [MaSi] according to GP - [0] and [2] should be compact int - but there is a single byte in tests
		const [jLength, z, cLength] = first3Numbers.decode(program);
		const jSize = z <= 8 ? 8 : z <= 16 ? 16 : 32;
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

	private isInstruction(counter: number) {
		const byteNumber = Math.floor(counter / 8);
		const bitNumber = counter % 8;
		const mask = 1 << bitNumber;
		return (this.program.k[byteNumber] & mask) > 0;
	}

	private getBytesToNextInstruction(counter: number) {
		let noOfBytes = 0;

		for (let i = counter + 1; i < 24; i++) {
			if (this.isInstruction(i)) {
				break;
			}

			noOfBytes++;
		}

		return noOfBytes;
	}

	private getArgs(instruction: number) {
		const argsType = instructionArgumentTypeMap[instruction];

		switch (argsType) {
			case ArgumentType.NO_ARGUMENTS:
				return [];
			case ArgumentType.THREE_REGISTERS: {
				const firstRegister = this.program.c[this.pc + 1] >> 4;
				const secondRegister = this.program.c[this.pc + 1] & 0x0f;
				const thirdRegister = this.program.c[this.pc + 2];
				return [firstRegister, secondRegister, thirdRegister];
			}

			case ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE: {
				const firstRegister = this.program.c[this.pc + 1] >> 4;
				const secondRegister = this.program.c[this.pc + 1] & 0x0f;
				const immediateBytes = this.getBytesToNextInstruction(this.pc + 1);
				const immediate = decodeImmediate(
					new Uint8Array(
						this.program.c.slice(this.pc + 2, this.pc + 2 + immediateBytes + 1), // TODO [MaSi] remove allocation
					),
				);

				return [firstRegister, secondRegister, immediate];
			}

			default:
				console.error("instruction was not matched!");
				return [];
		}
	}

	runProgram() {
		while (this.pc < this.program.cLength) {
			const currentInstruction = this.program.c[this.pc];

			if (!this.isInstruction(this.pc)) {
				this.pc++;
				continue;
			}

			const args = this.getArgs(currentInstruction);

			switch (currentInstruction) {
				case Instruction.ADD:
					this.mathOps.add(args[1], args[0], args[2]);
					break;
				case Instruction.ADD_IMM:
					this.mathOps.addImmediate(args[0], args[2], args[1]);
					break;
				case Instruction.MUL:
					this.mathOps.mul(args[1], args[0], args[2]);
					break;
				case Instruction.MUL_IMM:
					this.mathOps.mulImmediate(args[0], args[2], args[1]);
					break;
				case Instruction.SUB:
					this.mathOps.sub(args[1], args[0], args[2]);
					break;
				case Instruction.DIV_S:
					this.mathOps.divSigned(args[1], args[0], args[2]);
					break;
				case Instruction.DIV_U:
					this.mathOps.divUnsigned(args[1], args[0], args[2]);
					break;
				case Instruction.SHLO_L:
					this.shiftOps.shiftLogicalLeft(args[1], args[0], args[2]);
					break;
				case Instruction.SHLO_L_IMM:
					this.shiftOps.shiftLogicalLeftImmediate(args[0], args[2], args[1]);
					break;
				case Instruction.SHLO_L_IMM_ALT:
					this.shiftOps.shiftLogicalLeftImmediateAlternative(
						args[0],
						args[2],
						args[1],
					);
					break;
				case Instruction.SHLO_R:
					this.shiftOps.shiftLogicalRight(args[1], args[0], args[2]);
					break;
				case Instruction.SHLO_R_IMM:
					this.shiftOps.shiftLogicalRightImmediate(args[0], args[2], args[1]);
					break;
				case Instruction.SHLO_R_IMM_ALT:
					this.shiftOps.shiftLogicalRightImmediateAlternative(
						args[0],
						args[2],
						args[1],
					);
					break;
				case Instruction.SHAR_R:
					this.shiftOps.shiftAritmeticRight(args[1], args[0], args[2]);
					break;
				case Instruction.SHAR_R_IMM:
					this.shiftOps.shiftAritmeticRightImmediate(args[0], args[2], args[1]);
					break;
				case Instruction.SHAR_R_IMM_ALT:
					this.shiftOps.shiftAritmeticRightImmediateAlternative(
						args[0],
						args[2],
						args[1],
					);
					break;
				case Instruction.OR:
					this.bitOps.or(args[1], args[0], args[2]);
					break;
				case Instruction.OR_IMM:
					this.bitOps.orImmediate(args[0], args[2], args[1]);
					break;
				case Instruction.AND:
					this.bitOps.and(args[1], args[0], args[2]);
					break;
				case Instruction.AND_IMM:
					this.bitOps.andImmediate(args[0], args[2], args[1]);
					break;
				case Instruction.XOR:
					this.bitOps.xor(args[1], args[0], args[2]);
					break;
				case Instruction.XOR_IMM:
					this.bitOps.xorImmediate(args[0], args[2], args[1]);
					break;
				case Instruction.TRAP:
					break;
			}
			this.gas -= instructionGasMap[currentInstruction];
			this.pc++;
		}
	}

	getState() {
		const regs = Array<number>(13);

		for (let i = 0; i < 13; i++) {
			regs[i] = Number(this.registers.unsignedRegisters[i]);
		}

		return {
			pc: this.pc,
			regs,
			gas: this.gas,
			pageMap: this.pageMap,
			memory: this.memory,
			status: this.status,
		};
	}
}
