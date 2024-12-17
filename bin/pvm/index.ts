import { type Gas, Interpreter } from "@typeberry/pvm-interpreter";

const pvm = new Interpreter();

const program = new Uint8Array([
  0, 0, 17, 147, 95, 95, 112, 1, 0, 114, 111, 116, 111, 95, 95, 147, 147, 147, 40, 139, 1, 1, 1,
]);

pvm.reset(program, 0, 1000n as Gas);
pvm.printProgram();
pvm.runProgram();
console.info(`Registers: ${pvm.getRegisters().getAllU64()}`);
console.info(`Status: ${pvm.getStatus()}`);
console.info(`Gas: ${pvm.getGas()}`);
