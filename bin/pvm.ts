import { Pvm } from "@typeberry/pvm";

const program = new Uint8Array([
  0, 0, 44, 4, 8, 1, 4, 9, 1, 5, 3, 0, 2, 119, 255, 7, 7, 12, 82, 138, 8, 152, 8, 82, 169, 5, 243, 47, 137, 6, 5, 11, 0,
  82, 135, 4, 8, 4, 9, 17, 0, 82, 151, 4, 8, 4, 9, 73, 147, 82, 105, 117, 245,
]);

const pvm = new Pvm(program, { gas: 100000 });

pvm.printProgram();
pvm.runProgram();
