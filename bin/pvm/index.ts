import { type Gas, Interpreter } from "@typeberry/pvm-interpreter";

const pvm = new Interpreter();

const program = new Uint8Array([0, 0, 1, 30, 1]);

pvm.reset(program, 0, 1000n as Gas);
pvm.printProgram();
pvm.runProgram();
