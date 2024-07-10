type Byte = number;
type Name = string;
type Gas = number;
type NoOfImmediate = 0 | 1 | 2;
type NoOfOffset = 0 | 1;
type NoOfRegister = 0 | 1 | 2 | 3;
type Instruction = [Byte, Name, Gas];
type InstructionWithMetadata = [
	Byte,
	Name,
	Gas,
	NoOfOffset,
	NoOfImmediate,
	NoOfRegister,
];

type ArgsMetadata = {
	noOfOffset: NoOfOffset;
	noOfImmediate: NoOfImmediate;
	noOfRegister: NoOfRegister;
};

const defaultArgsMetadata: ArgsMetadata = {
	noOfImmediate: 0,
	noOfRegister: 0,
	noOfOffset: 0,
};

function withArgsMetadata() {
	const meta = { ...defaultArgsMetadata };
	const builder = {
		offset(value: NoOfOffset) {
			meta.noOfOffset = value;
			return builder;
		},
		register(value: NoOfRegister) {
			meta.noOfRegister = value;
			return builder;
		},
		immediate(value: NoOfImmediate) {
			meta.noOfImmediate = value;
			return builder;
		},
		get() {
			return (instruction: Instruction): InstructionWithMetadata => [
				...instruction,
				meta.noOfOffset,
				meta.noOfImmediate,
				meta.noOfRegister,
			];
		},
	};
	return builder;
}

const instructionsWithoutArgs: Instruction[] = [
	[0, "trap", 0],
	[17, "fallthrough", 0],
];

const instructionsWithArgsOfOneImmediate: Instruction[] = [[78, "ecalli", 0]];

const instructionsWithArgsOfTwoImmediate: Instruction[] = [
	[62, "store_imm_u8", 0],
	[79, "store_imm_u16", 0],
	[38, "store_imm_u32", 0],
];

const instructionsWithArgsOfOneOffset: Instruction[] = [[5, "jump", 0]];

const instructionsWithArgsOfOneRegisterAndOneImmediate: Instruction[] = [
	[19, "jump_ind", 0],
	[4, "load_imm", 0],
	[60, "load_u8", 0],
	[74, "load_i8", 0],
	[76, "load_u16", 0],
	[66, "load_i16", 0],
	[10, "load_u32", 0],
	[71, "store_u8", 0],
	[69, "store_u16", 0],
	[22, "store_u32", 0],
];

const instructionsWithArgsOfOneRegisterAndTwoImmediate: Instruction[] = [
	[26, "store_imm_ind_u8", 0],
	[54, "store_imm_ind_u16", 0],
	[13, "store_imm_ind_u32", 0],
];

const instructionsWithArgsOfOneRegisterOneImmediateAndOneOffset: Instruction[] =
	[
		[6, "load_imm_jump", 0],
		[7, "branch_eq_imm", 0],
		[15, "branch_ne_imm", 0],
		[44, "branch_lt_u_imm", 0],
		[59, "branch_le_u_imm", 0],
		[52, "branch_ge_u_imm", 0],
		[50, "branch_gt_u_imm", 0],
		[32, "branch_lt_s_imm", 0],
		[46, "branch_le_s_imm", 0],
		[45, "branch_ge_s_imm", 0],
		[53, "branch_gt_s_imm", 0],
	];

const instructionsWithArgsOfTwoRegisters: Instruction[] = [
	[82, "move_reg", 0],
	[87, "sbrk", 0],
];

const instructionsWithArgsOfTwoRegistersAndOneImmediate: Instruction[] = [
	[16, "store_ind_u8", 0],
	[29, "store_ind_u16", 0],
	[3, "store_ind_u32", 0],
	[11, "load_ind_u8", 0],
	[21, "load_ind_i8", 0],
	[37, "load_ind_u16", 0],
	[33, "load_ind_i16", 0],
	[1, "load_ind_u32", 0],
	[2, "add_imm", 0],
	[18, "and_imm", 0],
	[31, "xor_imm", 0],
	[49, "or_imm", 0],
	[35, "mul_imm", 0],
	[65, "mul_upper_s_s_imm ", 0],
	[63, "mul_upper_u_u_imm ", 0],
	[27, "set_lt_u_imm ", 0],
	[56, "set_lt_s_imm ", 0],
	[9, "shlo_l_imm ", 0],
	[14, "shlo_r_imm ", 0],
	[25, "shar_r_imm ", 0],
	[40, "neg_add_imm ", 0],
	[39, "set_gt_u_imm ", 0],
	[61, "set_gt_s_imm ", 0],
	[75, "shlo_l_imm_alt ", 0],
	[72, "shlo_r_imm_alt ", 0],
	[80, "shar_r_imm_alt ", 0],
	[85, "cmov_iz_imm ", 0],
	[86, "cmov_nz_imm ", 0],
];

const instructionsWithArgsOfTwoRegistersAndOneOffset: Instruction[] = [
	[24, "branch_eq", 0],
	[30, "branch_ne", 0],
	[47, "branch_lt_u", 0],
	[48, "branch_lt_s", 0],
	[41, "branch_ge_u", 0],
	[43, "branch_ge_s", 0],
];

const instructionWithArgumentsOfTwoRegistersAndTwoImmediates: Instruction[] = [
	[42, "load_imm_jump_ind", 0],
];

const instructionsWithArgumentsOfThreeRegisters: Instruction[] = [
	[8, "add", 0],
	[20, "sub", 0],
	[23, "and", 0],
	[28, "xor", 0],
	[12, "or", 0],
	[34, "mul", 0],
	[67, "mul_upper_s_s", 0],
	[57, "mul_upper_u_u", 0],
	[81, "mul_upper_s_u", 0],
	[68, "div_u", 0],
	[64, "div_s", 0],
	[73, "rem_u", 0],
	[70, "rem_s", 0],
	[36, "set_lt_u", 0],
	[58, "set_lt_s", 0],
	[55, "shlo_l", 0],
	[51, "shlo_r", 0],
	[77, "shar_r", 0],
	[83, "cmov_iz", 0],
	[84, "cmov_nz", 0],
];

const instructions: InstructionWithMetadata[] = [
	...instructionsWithoutArgs.map(withArgsMetadata().get()),
	...instructionsWithArgsOfOneImmediate.map(
		withArgsMetadata().immediate(1).get(),
	),
	...instructionsWithArgsOfTwoImmediate.map(
		withArgsMetadata().immediate(2).get(),
	),
	...instructionsWithArgsOfOneOffset.map(withArgsMetadata().offset(1).get()),
	...instructionsWithArgsOfOneRegisterAndOneImmediate.map(
		withArgsMetadata().register(1).immediate(1).get(),
	),
	...instructionsWithArgsOfOneRegisterAndTwoImmediate.map(
		withArgsMetadata().register(1).immediate(2).get(),
	),
	...instructionsWithArgsOfOneRegisterOneImmediateAndOneOffset.map(
		withArgsMetadata().register(1).immediate(1).offset(1).get(),
	),
	...instructionsWithArgsOfTwoRegisters.map(
		withArgsMetadata().register(2).get(),
	),
	...instructionsWithArgsOfTwoRegistersAndOneImmediate.map(
		withArgsMetadata().register(2).immediate(1).get(),
	),
	...instructionsWithArgsOfTwoRegistersAndOneOffset.map(
		withArgsMetadata().register(2).offset(1).get(),
	),
	...instructionWithArgumentsOfTwoRegistersAndTwoImmediates.map(
		withArgsMetadata().register(2).immediate(2).get(),
	),
	...instructionsWithArgumentsOfThreeRegisters.map(
		withArgsMetadata().register(3).get(),
	),
];

type OpCode = {
	name: Name;
	gas: Gas;
} & ArgsMetadata;

const createOpCodeEntry = ([
	byte,
	name,
	gas,
	noOfOffset,
	noOfImmediate,
	noOfRegister,
]: InstructionWithMetadata): [Byte, OpCode] => [
	byte,
	{ name, gas, noOfOffset, noOfRegister, noOfImmediate },
];

type ByteToOpCodeMap = { [key: Byte]: OpCode };

const byteToOpCodeMap = instructions.reduce((acc, instruction) => {
	const [byte, opCode] = createOpCodeEntry(instruction);
	acc[byte] = opCode;
	return acc;
}, {} as ByteToOpCodeMap);

export function assemblify(program: Array<number>, k: Array<number>) {
	const printableProgram = program.reduce(
		(acc, byte, index) => {
			const byteNumber = Math.floor(index / 8);
			const bitNumber = index % 8;
			const mask = 1 << bitNumber;
			const isOpCode = (k[byteNumber] & mask) > 0;
			if (isOpCode) {
				const instruction = byteToOpCodeMap[byte];
				acc.push([instruction.name]);
			} else {
				acc[acc.length - 1].push(byte);
			}
			return acc;
		},
		[] as Array<Array<string | number>>,
	);

	console.log(printableProgram);
}
