import { Pvm } from "./pvm";

const program = [
	// 0,
	// 0,
	// 3,
	// 8,
	// 135,
	// 9,
	// 249

	0, 0, 14, 4, 7, 10, 59, 23, 246, 5, 0, 4, 7, 239, 190, 173, 222, 137, 193,
];

const pvm = new Pvm(program);
pvm.printProgram();
