import { type Gas, Interpreter } from "@typeberry/pvm-interpreter";

const pvm = new Interpreter();

const program = new Uint8Array([0, 0, 10, 212, 138, 255, 250, 250, 250, 250, 250, 138, 14, 1, 1]);

pvm.reset(program, 0, 1000n as Gas);
pvm.printProgram();
pvm.runProgram();
console.info(`Status: ${pvm.getStatus()}`);
console.info(`Gas: ${pvm.getGas()}`);
