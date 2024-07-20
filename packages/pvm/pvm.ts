import type { FixedArray } from "../fixed-array";
import {
	ArgsDecoder,
	type ThreeRegistersResult,
	type TwoRegistersOneImmediateResult,
} from "./args-decoder/args-decoder";
import { assemblify } from "./assemblify";
import { Instruction } from "./instruction";
import { instructionGasMap } from "./instruction-gas-map";
import { BitOps } from "./ops/bit-ops";
import { MathOps } from "./ops/math-ops";
import { ShiftOps } from "./ops/shift-ops";
import type { Mask } from "./program-decoder/mask";
import { ProgramDecoder } from "./program-decoder/program-decoder";
import { NO_OF_REGISTERS, Registers } from "./registers";

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

export class Pvm {
	private pc = 0;
	private registers = new Registers();
	private mathOps = new MathOps(this.registers);
	private shiftOps = new ShiftOps(this.registers);
	private bitOps = new BitOps(this.registers);
	private gas: number;
	private pageMap: PageMapItem[];
	private memory: MemoryChunkItem[];
	private status: "trap" | "halt" = "trap";
	private argsDecoder: ArgsDecoder;
	private code: Uint8Array;
	private mask: Mask;

	constructor(rawProgram: Uint8Array, initialState: InitialState = {}) {
		const programDecoder = new ProgramDecoder(rawProgram);
		this.code = programDecoder.getCode();
		this.mask = programDecoder.getMask();

		this.pc = initialState.pc ?? 0;

		for (let i = 0; i < NO_OF_REGISTERS; i++) {
			this.registers.asUnsigned[i] = initialState.regs?.[i] ?? 0;
		}
		this.gas = initialState.gas ?? 0;
		this.pageMap = initialState.pageMap ?? [];
		this.memory = initialState.memory ?? [];
		this.argsDecoder = new ArgsDecoder(this.code, this.mask);
	}

	printProgram() {
		const p = assemblify(this.code, this.mask);
		console.table(p);
	}

	runProgram() {
		while (this.pc < this.code.length) {
			const currentInstruction = this.code[this.pc];
			const args = this.argsDecoder.getArgs(this.pc);

			switch (currentInstruction) {
				case Instruction.ADD: {
					const {
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					} = args as ThreeRegistersResult;
					this.mathOps.add(
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					);
					break;
				}
				case Instruction.ADD_IMM: {
					const { firstRegisterIndex, secondRegisterIndex, immediateDecoder1 } =
						args as TwoRegistersOneImmediateResult;
					this.mathOps.addImmediate(
						firstRegisterIndex,
						immediateDecoder1.getUnsigned(),
						secondRegisterIndex,
					);
					break;
				}
				case Instruction.MUL: {
					const {
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					} = args as ThreeRegistersResult;
					this.mathOps.mul(
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					);
					break;
				}
				case Instruction.MUL_UPPER_U_U: {
					const {
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					} = args as ThreeRegistersResult;
					this.mathOps.mulUpperUU(
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					);
					break;
				}
				case Instruction.MUL_UPPER_S_S: {
					const {
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					} = args as ThreeRegistersResult;
					this.mathOps.mulUpperSS(
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					);
					break;
				}
				case Instruction.MUL_UPPER_S_U: {
					const {
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					} = args as ThreeRegistersResult;
					this.mathOps.mulUpperSU(
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					);
					break;
				}
				case Instruction.MUL_IMM: {
					const { firstRegisterIndex, secondRegisterIndex, immediateDecoder1 } =
						args as TwoRegistersOneImmediateResult;
					this.mathOps.mulImmediate(
						firstRegisterIndex,
						immediateDecoder1.getSigned(),
						secondRegisterIndex,
					);
					break;
				}
				case Instruction.MUL_UPPER_U_U_IMM: {
					const { firstRegisterIndex, secondRegisterIndex, immediateDecoder1 } =
						args as TwoRegistersOneImmediateResult;
					this.mathOps.mulImmediate(
						firstRegisterIndex,
						immediateDecoder1.getUnsigned(),
						secondRegisterIndex,
					);
					break;
				}
				case Instruction.MUL_UPPER_S_S_IMM: {
					const { firstRegisterIndex, secondRegisterIndex, immediateDecoder1 } =
						args as TwoRegistersOneImmediateResult;
					this.mathOps.mulImmediate(
						firstRegisterIndex,
						immediateDecoder1.getSigned(),
						secondRegisterIndex,
					);
					break;
				}
				case Instruction.SUB: {
					const {
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					} = args as ThreeRegistersResult;
					this.mathOps.sub(
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					);
					break;
				}
				case Instruction.NEG_ADD_IMM: {
					const { firstRegisterIndex, immediateDecoder1, secondRegisterIndex } =
						args as TwoRegistersOneImmediateResult;
					this.mathOps.negAddImmediate(
						firstRegisterIndex,
						immediateDecoder1.getUnsigned(),
						secondRegisterIndex,
					);
					break;
				}
				case Instruction.DIV_S: {
					const {
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					} = args as ThreeRegistersResult;
					this.mathOps.divSigned(
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					);
					break;
				}
				case Instruction.DIV_U: {
					const {
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					} = args as ThreeRegistersResult;
					this.mathOps.divUnsigned(
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					);
					break;
				}
				case Instruction.REM_S: {
					const {
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					} = args as ThreeRegistersResult;
					this.mathOps.remSigned(
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					);
					break;
				}
				case Instruction.REM_U: {
					const {
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					} = args as ThreeRegistersResult;
					this.mathOps.remUnsigned(
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					);
					break;
				}
				case Instruction.SHLO_L: {
					const {
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					} = args as ThreeRegistersResult;
					this.shiftOps.shiftLogicalLeft(
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					);
					break;
				}
				case Instruction.SHLO_L_IMM: {
					const { firstRegisterIndex, secondRegisterIndex, immediateDecoder1 } =
						args as TwoRegistersOneImmediateResult;
					this.shiftOps.shiftLogicalLeftImmediate(
						firstRegisterIndex,
						immediateDecoder1.getUnsigned(),
						secondRegisterIndex,
					);
					break;
				}
				case Instruction.SHLO_L_IMM_ALT: {
					const { firstRegisterIndex, secondRegisterIndex, immediateDecoder1 } =
						args as TwoRegistersOneImmediateResult;
					this.shiftOps.shiftLogicalLeftImmediateAlternative(
						firstRegisterIndex,
						immediateDecoder1.getUnsigned(),
						secondRegisterIndex,
					);
					break;
				}
				case Instruction.SHLO_R: {
					const {
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					} = args as ThreeRegistersResult;
					this.shiftOps.shiftLogicalRight(
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					);
					break;
				}
				case Instruction.SHLO_R_IMM: {
					const { firstRegisterIndex, secondRegisterIndex, immediateDecoder1 } =
						args as TwoRegistersOneImmediateResult;
					this.shiftOps.shiftLogicalRightImmediate(
						firstRegisterIndex,
						immediateDecoder1.getUnsigned(),
						secondRegisterIndex,
					);
					break;
				}
				case Instruction.SHLO_R_IMM_ALT: {
					const { firstRegisterIndex, secondRegisterIndex, immediateDecoder1 } =
						args as TwoRegistersOneImmediateResult;
					this.shiftOps.shiftLogicalRightImmediateAlternative(
						firstRegisterIndex,
						immediateDecoder1.getUnsigned(),
						secondRegisterIndex,
					);
					break;
				}
				case Instruction.SHAR_R: {
					const {
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					} = args as ThreeRegistersResult;
					this.shiftOps.shiftArithmeticRight(
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					);
					break;
				}
				case Instruction.SHAR_R_IMM: {
					const { firstRegisterIndex, secondRegisterIndex, immediateDecoder1 } =
						args as TwoRegistersOneImmediateResult;
					this.shiftOps.shiftArithmeticRightImmediate(
						firstRegisterIndex,
						immediateDecoder1.getSigned(),
						secondRegisterIndex,
					);
					break;
				}
				case Instruction.SHAR_R_IMM_ALT: {
					const { firstRegisterIndex, secondRegisterIndex, immediateDecoder1 } =
						args as TwoRegistersOneImmediateResult;
					this.shiftOps.shiftArithmeticRightImmediateAlternative(
						firstRegisterIndex,
						immediateDecoder1.getSigned(),
						secondRegisterIndex,
					);
					break;
				}
				case Instruction.OR: {
					const {
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					} = args as ThreeRegistersResult;
					this.bitOps.or(
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					);
					break;
				}
				case Instruction.OR_IMM: {
					const { firstRegisterIndex, secondRegisterIndex, immediateDecoder1 } =
						args as TwoRegistersOneImmediateResult;
					this.bitOps.orImmediate(
						firstRegisterIndex,
						immediateDecoder1.getUnsigned(),
						secondRegisterIndex,
					);
					break;
				}
				case Instruction.AND: {
					const {
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					} = args as ThreeRegistersResult;
					this.bitOps.and(
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					);
					break;
				}
				case Instruction.AND_IMM: {
					const { firstRegisterIndex, secondRegisterIndex, immediateDecoder1 } =
						args as TwoRegistersOneImmediateResult;
					this.bitOps.andImmediate(
						firstRegisterIndex,
						immediateDecoder1.getUnsigned(),
						secondRegisterIndex,
					);
					break;
				}
				case Instruction.XOR: {
					const {
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					} = args as ThreeRegistersResult;
					this.bitOps.xor(
						firstRegisterIndex,
						secondRegisterIndex,
						thirdRegisterIndex,
					);
					break;
				}
				case Instruction.XOR_IMM: {
					const { firstRegisterIndex, secondRegisterIndex, immediateDecoder1 } =
						args as TwoRegistersOneImmediateResult;
					this.bitOps.xorImmediate(
						firstRegisterIndex,
						immediateDecoder1.getUnsigned(),
						secondRegisterIndex,
					);
					break;
				}
				case Instruction.TRAP: {
					this.status = "trap";
					this.gas -= instructionGasMap[currentInstruction];
					return;
				}
			}
			this.gas -= instructionGasMap[currentInstruction];
			this.pc += args.noOfInstructionsToSkip;
		}
	}

	getState() {
		const regs = Array<number>(NO_OF_REGISTERS);

		for (let i = 0; i < NO_OF_REGISTERS; i++) {
			regs[i] = Number(this.registers.asUnsigned[i]);
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
