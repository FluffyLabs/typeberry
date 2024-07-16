import { ArgumentType } from "./argument-type";
import { ImmediateDecoder } from "./decoders/immediate-decoder";
import { RegisterIndexDecoder } from "./decoders/register-index-decoder";
import { instructionArgumentTypeMap } from "./instruction-argument-type-map";

type BaseResult = {
	noOfInstructionsToSkip: number;

	firstRegisterIndex: number;
	secondRegisterIndex: number;
	thirdRegisterIndex: number;

	immediateDecoder1: ImmediateDecoder;
	immediateDecoder2: ImmediateDecoder;

	offset: unknown;
};
type ArgType<T extends ArgumentType> = { argumentType: T };

export type NoArgumentsResult = ArgType<ArgumentType.NO_ARGUMENTS> &
	Pick<BaseResult, "noOfInstructionsToSkip">;
export type ThreeRegistersResult = ArgType<ArgumentType.THREE_REGISTERS> &
	Pick<
		BaseResult,
		| "noOfInstructionsToSkip"
		| "firstRegisterIndex"
		| "secondRegisterIndex"
		| "thirdRegisterIndex"
	>;
export type TwoRegistersOneImmediateResult =
	ArgType<ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE> &
		Pick<
			BaseResult,
			| "noOfInstructionsToSkip"
			| "firstRegisterIndex"
			| "secondRegisterIndex"
			| "immediateDecoder1"
		>;

type Result =
	| NoArgumentsResult
	| ThreeRegistersResult
	| TwoRegistersOneImmediateResult;

const createResult = (): Partial<BaseResult> => ({
	noOfInstructionsToSkip: 1,

	firstRegisterIndex: undefined,
	secondRegisterIndex: undefined,
	thirdRegisterIndex: undefined,

	immediateDecoder1: undefined,
	immediateDecoder2: undefined,

	offset: undefined,
});

const MAX_ARGS_LENGTH = 24;

export class ArgsDecoder {
	private registerIndexDecoder = new RegisterIndexDecoder();
	private immediateDecoder1 = new ImmediateDecoder();
	private immediateDecoder2 = new ImmediateDecoder();

	private result = createResult(); // [MaSi] because I don't want to allocate memory for each instruction

	constructor(
		private code: number[],
		private mask: number[],
	) {}

	private isInstruction(counter: number) {
		const byteNumber = Math.floor(counter / 8);
		const bitNumber = counter % 8;
		const mask = 1 << bitNumber;
		return (this.mask[byteNumber] & mask) > 0;
	}

	private getBytesToNextInstruction(counter: number) {
		let noOfBytes = 0;
		for (let i = counter + 1; i <= counter + MAX_ARGS_LENGTH; i++) {
			if (this.isInstruction(i)) {
				break;
			}

			noOfBytes++;
		}

		return noOfBytes;
	}

	private resetResult() {
		this.result.noOfInstructionsToSkip = 1;

		this.result.firstRegisterIndex = undefined;
		this.result.secondRegisterIndex = undefined;
		this.result.thirdRegisterIndex = undefined;

		this.result.immediateDecoder1 = undefined;
		this.result.immediateDecoder2 = undefined;

		this.result.offset = undefined;
	}

	getArgs(pc: number): Result {
		this.resetResult();

		const instruction = this.code[pc];
		const argsType = instructionArgumentTypeMap[instruction];

		switch (argsType) {
			case ArgumentType.NO_ARGUMENTS:
				return this.result as NoArgumentsResult;
			case ArgumentType.THREE_REGISTERS: {
				this.result.noOfInstructionsToSkip = 3;
				const firstByte = this.code[pc + 1];
				const secondByte = this.code[pc + 2];
				this.registerIndexDecoder.setByte(firstByte);
				this.result.firstRegisterIndex =
					this.registerIndexDecoder.getFirstIndex();
				this.result.secondRegisterIndex =
					this.registerIndexDecoder.getSecondIndex();
				this.registerIndexDecoder.setByte(secondByte);
				this.result.thirdRegisterIndex =
					this.registerIndexDecoder.getSecondIndex();
				return this.result as ThreeRegistersResult;
			}

			case ArgumentType.TWO_REGISTERS_ONE_IMMEDIATE: {
				const firstByte = this.code[pc + 1];
				this.registerIndexDecoder.setByte(firstByte);
				this.result.firstRegisterIndex =
					this.registerIndexDecoder.getFirstIndex();
				this.result.secondRegisterIndex =
					this.registerIndexDecoder.getSecondIndex();

				const immediateBytes = this.getBytesToNextInstruction(pc + 1) + 1;
				this.result.noOfInstructionsToSkip = 1 + immediateBytes;

				this.immediateDecoder1.setBytes(
					new Uint8Array(
						this.code.slice(pc + 2, pc + 2 + immediateBytes + 1), // TODO [MaSi] remove allocation
					),
				);
				this.result.immediateDecoder1 = this.immediateDecoder1;
				return this.result as TwoRegistersOneImmediateResult;
			}

			default:
				throw new Error("instruction was not matched!");
		}
	}
}
